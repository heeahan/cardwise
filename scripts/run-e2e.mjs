import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoPort = "3010";
const failClosedPort = "3011";
const demoHealthUrl = `http://127.0.0.1:${demoPort}/api/health`;
const failClosedOrigin = `http://127.0.0.1:${failClosedPort}`;
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(root, "node_modules", "@playwright", "test", "cli.js");

const isHealthy = async (url) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch { return false; }
};

const waitForServer = async (server, healthUrl, label) => {
  for (let attempt = 0; attempt < 80 && !await isHealthy(healthUrl); attempt += 1) {
    if (server.exitCode !== null) throw new Error(`${label} exited before readiness (${server.exitCode})`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!await isHealthy(healthUrl)) throw new Error(`${label} did not become healthy within 40 seconds`);
};

const stopProcess = async (processHandle) => {
  if (!processHandle || processHandle.exitCode !== null) return;
  processHandle.kill();
  await Promise.race([once(processHandle, "exit"), new Promise((resolve) => setTimeout(resolve, 5000))]);
};

if (await isHealthy(demoHealthUrl) || await isHealthy(`${failClosedOrigin}/api/health`)) {
  console.error("E2E ports 3010/3011 are already in use; refusing to reuse unknown servers.");
  process.exit(1);
}

let server;
let failClosedServer;
let runner;
const stop = () => {
  if (runner?.exitCode === null) runner.kill();
  if (server?.exitCode === null) server.kill();
  if (failClosedServer?.exitCode === null) failClosedServer.kill();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

let exitCode = 1;
try {
  failClosedServer = spawn(process.execPath, [nextCli, "start", "-p", failClosedPort], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "false", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" },
  });
  await waitForServer(failClosedServer, `${failClosedOrigin}/api/health`, "Fail-closed Next server");
  const protectedResponse = await fetch(`${failClosedOrigin}/dashboard`, { redirect: "manual" });
  const location = protectedResponse.headers.get("location") ?? "";
  if (![303, 307, 308].includes(protectedResponse.status) || !location.includes("/login?error=configuration_required")) {
    throw new Error(`Production configuration guard failed: ${protectedResponse.status} ${location}`);
  }
  const apiResponse = await fetch(`${failClosedOrigin}/api/cards`);
  const apiBody = await apiResponse.json();
  if (apiResponse.status !== 503 || apiBody?.error?.code !== "AUTH_CONFIGURATION_ERROR") {
    throw new Error(`Production API configuration guard failed: ${apiResponse.status}`);
  }
  await stopProcess(failClosedServer);

  server = spawn(process.execPath, [nextCli, "start", "-p", demoPort], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "true", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" },
  });
  await waitForServer(server, demoHealthUrl, "Demo Next server");

  runner = spawn(process.execPath, [playwrightCli, "test"], { cwd: root, stdio: "inherit", env: process.env });
  const [code] = await once(runner, "exit");
  exitCode = typeof code === "number" ? code : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "E2E orchestration failed");
} finally {
  stop();
  await Promise.all([stopProcess(server), stopProcess(failClosedServer)]);
}

process.exitCode = exitCode;
