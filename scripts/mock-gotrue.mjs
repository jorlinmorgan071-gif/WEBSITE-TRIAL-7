#!/usr/bin/env node
/**
 * STEP 4A — TEST-ONLY mock of the Supabase Auth (GoTrue) HTTP API.
 *
 * The local test suite has no hosted Supabase project, so this tiny server
 * stands in for the AUTH SERVICE ONLY (never the database). It lets the
 * real @supabase/ssr session-check code run end-to-end against real cookies:
 *
 *   GET  /auth/v1/user  with "Authorization: Bearer test-admin-token"
 *                       -> owner@lakeflavour.test (in ADMIN_EMAILS)
 *   GET  /auth/v1/user  with "Authorization: Bearer test-other-token"
 *                       -> someone-else@example.com (NOT an admin)
 *   other tokens        -> 401 (not signed in)
 *   POST /auth/v1/otp   -> 200 (magic-link "sent")
 *   POST /auth/v1/token / logout -> 200/204
 *
 * Listen port: 3600 (matches NEXT_PUBLIC_SUPABASE_URL in .env.local tests).
 */

import http from "node:http";

const PORT = Number(process.env.MOCK_GOTRUE_PORT ?? 3600);

const USERS = {
  "test-admin-token": {
    id: "11111111-1111-4111-8111-111111111111",
    email: "owner@lakeflavour.test",
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  "test-other-token": {
    id: "22222222-2222-4222-8222-222222222222",
    email: "someone-else@example.com",
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
};

function bearer(req) {
  const auth = req.headers["authorization"] ?? "";
  return auth.replace(/^Bearer\s+/i, "");
}

const server = http.createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (req.method === "GET" && url.pathname === "/auth/v1/user") {
    const user = USERS[bearer(req)];
    if (user) send(200, user);
    else send(401, { code: 401, msg: "Invalid token" });
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/auth/v1/token")) {
    // token grant/refresh — hand back a fake session for the mock tokens
    const user = USERS[bearer(req)];
    send(200, {
      access_token: "test-admin-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "test-refresh-token",
      user: user ?? USERS["test-admin-token"],
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/auth/v1/otp") {
    send(200, {});
    return;
  }
  if (req.method === "POST" && url.pathname === "/auth/v1/logout") {
    send(204, "");
    return;
  }
  send(404, { error: "not_found", path: url.pathname });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-gotrue] listening on http://127.0.0.1:${PORT}/auth/v1`);
});
