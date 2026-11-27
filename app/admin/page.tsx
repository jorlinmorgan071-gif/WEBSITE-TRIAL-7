import { redirect } from "next/navigation";

/** /admin → the orders dashboard. Dynamic so the redirect runs per request
 *  (a statically prerendered redirect would serve 200 instead of 307). */
export const dynamic = "force-dynamic";

export default function AdminIndexPage() {
  redirect("/admin/orders");
}
