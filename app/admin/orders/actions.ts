"use server";

/**
 * STEP 4A — owner order actions (server actions).
 * Every action checks admin access ON THE SERVER first — the UI guard is
 * never the only guard. Status changes run through set_order_status_v1
 * (allowed transitions + audit event + stock restore on cancel).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUserEmail } from "@/lib/server/admin-auth";
import { setOrderStatusInDb } from "@/lib/server/orders";
import { ALLOWED_STATUS_TRANSITIONS, type OrderStatus } from "@/lib/order-status";

export async function setOrderStatusAction(formData: FormData): Promise<void> {
  // Server-side guard for every request — no exceptions for actions.
  const adminEmail = await getAdminUserEmail();
  if (!adminEmail) {
    redirect("/");
  }

  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextStatus = String(formData.get("nextStatus") ?? "").trim();
  const currentStatus = String(formData.get("currentStatus") ?? "").trim();

  if (!orderId || !nextStatus) return;

  // Mirror of the database transition rules — reject impossible moves early.
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus as OrderStatus] ?? [];
  if (!allowed.includes(nextStatus as OrderStatus)) {
    console.warn(
      `[admin] ${adminEmail} tried invalid transition ${currentStatus} -> ${nextStatus} on ${orderId}`
    );
    revalidatePath("/admin/orders");
    return;
  }

  const outcome = await setOrderStatusInDb(orderId, nextStatus, `by ${adminEmail}`);
  if (!outcome.ok) {
    console.error(`[admin] status change failed for ${orderId}: ${outcome.code}`);
  }
  revalidatePath("/admin/orders");
}
