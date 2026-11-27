import {
  ALLOWED_STATUS_TRANSITIONS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  STATUS_ACTION_LABELS,
  formatNairobiDate,
  type OrderStatus,
} from "@/lib/order-status";
import { formatPrice } from "@/lib/order";
import { displayLocalPhone } from "@/lib/phone";
import { paymentMethodLabel } from "@/lib/payment";
import type { DbOrder } from "@/lib/server/db";
import { setOrderStatusAction } from "@/app/admin/orders/actions";

/**
 * STEP 4A — one order card in the owner dashboard.
 * A <details> row: tap to open the full order (customer contact, items,
 * notes) and the status buttons. Mobile-first — everything stacks on phones.
 * The buttons only offer transitions the database allows; the action
 * re-checks on the server anyway.
 */
export default function OrderCard({ order }: { order: DbOrder }) {
  const status = order.status as OrderStatus;
  const transitions = ALLOWED_STATUS_TRANSITIONS[status] ?? [];
  const forward = transitions.filter((t) => t !== "cancelled");
  const canCancel = transitions.includes("cancelled");
  const total = order.total_kes ?? order.subtotal_kes;

  return (
    <details className="group rounded-2xl border border-cream/10 bg-surface/40 focus-within:border-gold/30 open:border-gold/30">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5">
        <span className="font-sans text-sm font-semibold text-cream">
          {order.order_number}
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] ${ORDER_STATUS_STYLES[status] ?? ""}`}
        >
          {ORDER_STATUS_LABELS[status] ?? order.status}
        </span>
        <span className="ml-auto font-sans text-sm font-semibold text-cream">
          {formatPrice(total)}
        </span>
        <span className="w-full font-sans text-xs text-muted sm:w-auto sm:text-right">
          {formatNairobiDate(order.created_at)}
          {order.area ? ` · ${order.area}` : ""}
        </span>
      </summary>

      <div className="flex flex-col gap-4 border-t border-cream/10 px-4 py-4 sm:px-5">
        {/* customer */}
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Customer
          </span>
          <p className="font-sans text-sm text-cream/90">{order.customer_name}</p>
          <p className="font-sans text-sm text-cream/85">
            <a
              href={`tel:+${order.phone}`}
              className="text-gold-light underline decoration-gold/40 underline-offset-4 transition-colors duration-300 ease-luxe hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
            >
              {displayLocalPhone(order.phone)}
            </a>
            {" · "}
            <a
              href={`https://wa.me/${order.phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-light underline decoration-gold/40 underline-offset-4 transition-colors duration-300 ease-luxe hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
            >
              WhatsApp
            </a>
            {order.email ? (
              <>
                {" · "}
                <a
                  href={`mailto:${order.email}`}
                  className="break-all text-gold-light underline decoration-gold/40 underline-offset-4 transition-colors duration-300 ease-luxe hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
                >
                  {order.email}
                </a>
              </>
            ) : null}
          </p>
          <p className="font-sans text-sm text-cream/85">
            {order.area} — {order.address_details}
          </p>
          {order.notes ? (
            <p className="font-sans text-sm text-muted">Notes: {order.notes}</p>
          ) : null}
        </div>

        {/* items */}
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Items
          </span>
          <ul className="flex flex-col gap-1">
            {order.items.map((item, i) => (
              <li
                key={`${order.id}-${i}`}
                className="flex items-baseline justify-between gap-3 font-sans text-sm text-cream/85"
              >
                <span>
                  {item.quantity} × {item.product_name} ({item.option_label})
                </span>
                <span>{formatPrice(item.line_total_kes)}</span>
              </li>
            ))}
          </ul>
          <p className="font-sans text-xs text-muted">
            Subtotal {formatPrice(order.subtotal_kes)} ·{" "}
            {order.total_kes !== null
              ? `Total ${formatPrice(order.total_kes)} (delivery included)`
              : "Delivery fee to confirm with the customer"}
          </p>
          <p className="font-sans text-xs text-muted">
            {paymentMethodLabel(order.payment_method)} · payment{" "}
            {order.payment_status.replace(/_/g, " ")}
          </p>
        </div>

        {/* status actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {forward.map((next) => (
            <form key={next} action={setOrderStatusAction} className="inline">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="nextStatus" value={next} />
              <input type="hidden" name="currentStatus" value={status} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-gold px-5 font-sans text-sm font-semibold text-background transition-colors duration-300 ease-luxe hover:bg-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
              >
                {STATUS_ACTION_LABELS[next]}
              </button>
            </form>
          ))}

          {/* Cancel is a deliberate two-step (no accidental cancellations). */}
          {canCancel && (
            <details className="inline-block">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center justify-center rounded-full border border-cream/25 px-5 font-sans text-sm font-semibold text-muted transition-colors duration-300 ease-luxe hover:border-cream/50 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light">
                Cancel order…
              </summary>
              <form action={setOrderStatusAction} className="mt-2.5 inline">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="nextStatus" value="cancelled" />
                <input type="hidden" name="currentStatus" value={status} />
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-gold-light/60 px-5 font-sans text-sm font-semibold text-gold-light transition-colors duration-300 ease-luxe hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
                >
                  Yes, cancel and return stock
                </button>
              </form>
            </details>
          )}
        </div>
      </div>
    </details>
  );
}
