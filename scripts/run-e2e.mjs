import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = "3010";
const healthUrl = `http://127.0.0.1:${port}/api/health`;
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(root, "node_modules", "@playwright", "test", "cli.js");

const isHealthy = async () => {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch { return false; }
};

if (await isHealthy()) {
  console.error(`E2E port ${port} is already in use; refusing to reuse an unknown server.`);
  process.exit(1);
}

const server = spawn(process.execPath, [nextCli, "start", "-p", port], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    CARDWISE_ENABLE_DEMO_MODE: "true",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
});

let runner;
const stop = () => {
  if (runner && runner.exitCode === null) runner.kill();
  if (server.exitCode === null) server.kill();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

let exitCode = 1;
try {
  for (let attempt = 0; attempt < 80 && !await isHealthy(); attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next server exited before readiness (${server.exitCode})`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!await isHealthy()) throw new Error("Next server did not become healthy within 40 seconds");

  runner = spawn(process.execPath, [playwrightCli, "test"], { cwd: root, stdio: "inherit", env: process.env });
  const [code] = await once(runner, "exit");
  exitCode = typeof code === "number" ? code : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "E2E orchestration failed");
} finally {
  stop();
  if (server.exitCode === null) await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 5000))]);
}

process.exitCode = exitCode;
