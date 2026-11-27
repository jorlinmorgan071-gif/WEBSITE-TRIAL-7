/**
 * TEST-ONLY helper: spawn a production Next.js server (`next start`) with a
 * specific environment, wait until it answers, and collect its output.
 *
 * Environment variables passed in `env` override .env.local (Next keeps
 * existing process env above env files), which is how the test phases point
 * the app at different email backends.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function startNext({ port, env = {}, dev = false }) {
  const child = spawn(
    process.execPath,
    [
      path.join("node_modules", "next", "dist", "bin", "next"),
      dev ? "dev" : "start",
      "-p",
      String(port),
    ],
    { cwd: repo, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }
  );

  let output = "";
  child.stdout.on("data", (d) => (output += d.toString()));
  child.stderr.on("data", (d) => (output += d.toString()));
  child.on("exit", (code, signal) => {
    output += `\n[next start :${port}] exited code=${code} signal=${signal}\n`;
  });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120000;
  for (;;) {
    try {
      const res = await fetch(base, { redirect: "manual" });
      if (res.status < 500) {
        return { child, base, port, output: () => output };
      }
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill("SIGKILL");
      throw new Error(`next start on :${port} did not become ready\n${output}`);
    }
    if (child.exitCode !== null) {
      throw new Error(`next start on :${port} exited early\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

export async function stopNext(handle) {
  if (!handle?.child || handle.child.exitCode !== null) return;
  handle.child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);
    handle.child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
