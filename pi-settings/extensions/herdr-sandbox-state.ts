// Reports pi state to herdr from inside a glaipnir sandbox.
// The herdr socket is unreachable from the microVM, so this goes through the
// glaipnir host proxy (`herdr` shim in /usr/local/bin, see glaipnir.conf CMDS).
// Inactive on the host (herdr-agent-state.ts handles that there).
// @ts-nocheck

import { execFile } from "node:child_process";
import { appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Debug log, only when HERDR_SANDBOX_DEBUG=1 is set in the sandbox.
// Persists on the host at ~/.cache/glaipnir/agents-mount/.pi/agent/herdr-sandbox.log
const debug = process.env.HERDR_SANDBOX_DEBUG === "1";
const logFile = path.join(os.homedir(), ".pi", "agent", "herdr-sandbox.log");
function log(msg: string) {
  if (!debug) return;
  try { appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`); } catch {}
}

const proxied = !!process.env.GLAIPNIR_PROXY_PORT && process.env.HERDR_ENV !== "1";
const source = "herdr:pi-sandbox";

let paneId: string | undefined;
let seq = Date.now() * 1000;

function run(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile("herdr", args, { timeout: 5000 }, (err, stdout, stderr) => {
      log(`herdr ${args.slice(0, 2).join(" ")} ${args.includes("--state") ? args[args.indexOf("--state") + 1] : ""} -> ${err ? "ERR " + err.message + " " + stderr : "ok " + String(stdout).slice(0, 120)}`);
      resolve(err ? "" : String(stdout));
    });
  });
}

async function resolvePane(): Promise<string | undefined> {
  if (paneId) return paneId;
  try {
    const out = await run(["pane", "current"]);
    paneId = JSON.parse(out)?.result?.pane?.pane_id;
  } catch {}
  return paneId;
}

let chain: Promise<void> = Promise.resolve();
function report(state: "working" | "idle") {
  chain = chain.then(async () => {
    const pane = await resolvePane();
    if (!pane) return;
    await run(["pane", "report-agent", "--source", source, "--agent", "pi",
      "--state", state, "--seq", String(++seq), pane]);
  });
}

function release() {
  chain = chain.then(async () => {
    const pane = await resolvePane();
    if (!pane) return;
    // release-agent only parses with the pane id before the options.
    await run(["pane", "release-agent", pane, "--source", source, "--agent", "pi",
      "--seq", String(++seq)]);
  });
  return chain;
}

export default function (pi) {
  if (!proxied) return;
  let root = false;

  pi.on("session_start", async (_e, ctx) => {
    log(`session_start mode=${ctx?.mode}`);
    if (ctx?.mode !== "tui") return;
    root = true;
    report(ctx?.isIdle?.() === false ? "working" : "idle");
  });
  // Hand the pane back to herdr, else it keeps showing pi after the sandbox ends.
  pi.on("session_shutdown", async (e) => {
    log(`session_shutdown reason=${e?.reason} root=${root}`);
    if (root) await release();
    log("shutdown release done");
  });
  pi.on("agent_start", () => { if (root) report("working"); });
  pi.on("agent_settled", (_e, ctx) => {
    if (root && ctx?.isIdle?.() === true) report("idle");
  });
}
