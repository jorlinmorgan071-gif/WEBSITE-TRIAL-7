#!/usr/bin/env node
/**
 * STEP 4A — Row Level Security tests (local Postgres; the same policies run
 * on the hosted Supabase project).
 *
 * The anon/authenticated roles mirror exactly what PostgREST (and therefore
 * the anon key) does on a hosted Supabase project: connecting AS the role
 * and letting RLS + table grants decide.
 *
 *   node scripts/test-rls.mjs
 */

import assert from "node:assert/strict";
import postgres from "postgres";

const SUPER_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5333/lakeflavour";
const ANON_URL = "postgres://anon:anon@127.0.0.1:5333/lakeflavour";
const AUTH_URL = "postgres://authenticated:authenticated@127.0.0.1:5333/lakeflavour";
const SERVICE_URL = "postgres://service_role:service_role@127.0.0.1:5333/lakeflavour";

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn()
    .then(() => {
      passed++;
      console.log(`  PASS  ${name}`);
    })
    .catch((error) => {
      failed++;
      console.log(`  FAIL  ${name}`);
      console.log(`        ${error.message}`);
    });
}

/** Assert a query on `url` fails with insufficient privilege (42501). */
async function expectPermissionDenied(url, label, fn) {
  const sql = postgres(url, { max: 1 });
  let code = null;
  try {
    await fn(sql);
  } catch (error) {
    code = error.code ?? null;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
  assert.ok(
    code === "42501" || /permission denied/i.test(String(code ?? "")),
    `${label}: expected permission denied (42501), got ${code}`
  );
}

const run = async () => {
  const superSql = postgres(SUPER_URL, { max: 1 });

  console.log("== setup ==");

  // An inactive product proves the RLS policy filters (anon must not see it).
  await superSql`
    insert into products (slug, name, tagline, is_active)
    values ('hidden-test-product', 'Hidden Product', 'should be invisible', false)
    on conflict (slug) do update set is_active = false`;
  // An order to prove anon cannot read it.
  const [probe] = await superSql`
    insert into orders (order_number, customer_name, phone, area, address_details, subtotal_kes)
    values ('LF-TEST-RLS-0001', 'Probe Customer', '254700000000', 'Kilimani', 'probe address', 400)
    returning id`;
  await superSql`
    insert into order_events (order_id, type, note) values (${probe.id}, 'created', 'RLS probe')`;

  console.log("== anon (public) reads ==");

  await test("anon reads ONLY active products (policy filters)", async () => {
    const anon = postgres(ANON_URL, { max: 1 });
    const rows = await anon`select slug, is_active from products`;
    await anon.end();
    assert.ok(rows.every((r) => r.is_active === true), "anon saw an inactive product");
    assert.ok(!rows.some((r) => r.slug === "hidden-test-product"), "inactive product leaked");
    assert.ok(rows.some((r) => r.slug === "fried-omena"), "active product missing");
  });

  await test("anon reads ONLY active options", async () => {
    const anon = postgres(ANON_URL, { max: 1 });
    const rows = await anon`select is_active from product_options`;
    await anon.end();
    assert.ok(rows.every((r) => r.is_active === true));
  });

  console.log("== anon CANNOT read order data ==");

  await test("anon cannot select orders", () =>
    expectPermissionDenied(ANON_URL, "orders", (sql) => sql`select * from orders`));
  await test("anon cannot select order_items", () =>
    expectPermissionDenied(ANON_URL, "order_items", (sql) => sql`select * from order_items`));
  await test("anon cannot select order_events", () =>
    expectPermissionDenied(ANON_URL, "order_events", (sql) => sql`select * from order_events`));
  await test("authenticated cannot select orders either", () =>
    expectPermissionDenied(AUTH_URL, "orders", (sql) => sql`select * from orders`));

  console.log("== anon CANNOT write anything ==");

  await test("anon cannot insert products", () =>
    expectPermissionDenied(ANON_URL, "insert products", (sql) =>
      sql`insert into products (slug, name) values ('anon-attack', 'x')`));
  await test("anon cannot update products", () =>
    expectPermissionDenied(ANON_URL, "update products", (sql) =>
      sql`update products set name = 'x' where slug = 'fried-omena'`));
  await test("anon cannot insert orders directly", () =>
    expectPermissionDenied(ANON_URL, "insert orders", (sql) =>
      sql`insert into orders (order_number, customer_name, phone, area, address_details, subtotal_kes)
          values ('LF-HACK-0001', 'x', '254700000001', 'x', 'xxxx', 1)`));
  await test("anon cannot insert order_events", () =>
    expectPermissionDenied(ANON_URL, "insert order_events", (sql) =>
      sql`insert into order_events (order_id, type) values (${probe.id}, 'spam')`));

  console.log("== anon CANNOT call the order functions ==");

  await test("anon cannot call create_order_v1", () =>
    expectPermissionDenied(ANON_URL, "create_order_v1", (sql) =>
      sql`select create_order_v1('{"customer":{"name":"Bot Bot","phone":"254700000002","area":"Kilimani","address_details":"bots house","consent_given":true,"payment_method":"pay_on_delivery"},"items":[]}'::jsonb)`));
  await test("anon cannot call set_order_status_v1", () =>
    expectPermissionDenied(ANON_URL, "set_order_status_v1", (sql) =>
      sql`select set_order_status_v1(${probe.id}::uuid, 'delivered', null)`));

  console.log("== service_role (server) CAN — and bypasses RLS ==");

  await test("service_role reads orders (bypasses RLS)", async () => {
    const svc = postgres(SERVICE_URL, { max: 1 });
    const rows = await svc`select order_number from orders where id = ${probe.id}`;
    await svc.end();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].order_number, "LF-TEST-RLS-0001");
  });

  console.log("== cleanup ==");

  await superSql`delete from order_events where order_id = ${probe.id}`;
  await superSql`delete from orders where id = ${probe.id}`;
  await superSql`delete from products where slug = 'hidden-test-product'`;
  await superSql.end();

  console.log("");
  if (failed === 0) {
    console.log(`ALL ${passed} RLS TESTS PASSED`);
    process.exit(0);
  } else {
    console.log(`${passed} passed, ${failed} FAILED`);
    process.exit(1);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
