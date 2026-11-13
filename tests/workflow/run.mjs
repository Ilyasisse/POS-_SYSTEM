import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { healthy, localServices, waitFor } from "./services.mjs";

const mode = process.argv[2];
if (mode !== "integration" && mode !== "e2e") throw new Error("Expected integration or e2e.");
for (const file of [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
]) {
  if (existsSync(file))
    throw new Error(
      `Run in a test worktree without ${file}. The runner supplies its own environment.`,
    );
}
const appUrl = "http://127.0.0.1:55430";
const project = `cafe-pos-tests-${randomUUID().slice(0, 8)}`;

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args[0]} failed`, { cause: result.error });
  }
}

function nodeScript(path, args, env) {
  run(process.execPath, [resolve(path), ...args], env);
}

function runTests(args, env) {
  return new Promise((resolve, reject) => {
    tests = spawn(process.execPath, args, { stdio: "inherit", env });
    tests.once("error", reject);
    tests.once("exit", (status) => {
      tests = undefined;
      if (status === 0) resolve();
      else reject(new Error(`The ${mode} suite exited with status ${status}.`));
    });
  });
}

const services = localServices(project, appUrl, run);
let server;
let tests;
function cleanup() {
  tests?.kill();
  server?.kill();
  try {
    services.stop();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

for (const [signal, status] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  process.once(signal, () => {
    cleanup();
    process.exit(status);
  });
}

try {
  const osEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) =>
      /^(path|pathext|systemroot|windir|comspec|home|userprofile|appdata|localappdata|temp|tmp|tmpdir|ci|playwright_browsers_path)$/i.test(
        name,
      ),
    ),
  );
  const env = {
    ...osEnv,
    ...(await services.start()),
    MACRODROID_PAYMENT_WEBHOOK_SECRET: randomUUID(),
    MACRODROID_PAYMENT_SMS_SENDER: "898",
    NEXT_TELEMETRY_DISABLED: "1",
    // Next's development instrumentation requires these settings for hydration.
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "workflow-test",
    NEXT_PUBLIC_POSTHOG_HOST: "http://127.0.0.1:55421/telemetry",
    CAFE_POS_TEST_URL: appUrl,
    CAFE_POS_TEST_SCOPE: process.env.CAFE_POS_TEST_SCOPE ?? "all",
  };
  const prisma = "node_modules/prisma/build/index.js";
  nodeScript(prisma, ["generate"], env);
  nodeScript(prisma, ["db", "push"], env);
  nodeScript(prisma, ["db", "execute", "--file", "tests/workflow/constraints.sql"], env);

  const next = resolve("node_modules/next/dist/bin/next");
  server = spawn(process.execPath, [next, "dev", "--hostname", "127.0.0.1", "--port", "55430"], {
    env,
    stdio: "inherit",
  });
  await waitFor("Cafe POS", () => {
    if (server.exitCode !== null) throw new Error("The Cafe POS test server exited.");
    return healthy(`${appUrl}/api/GET/Category`);
  });

  if (mode === "integration") {
    const specs =
      env.CAFE_POS_TEST_SCOPE === "core"
        ? ["api-orders", "auth", "customer-checkout", "kitchen-waiter"].map(
            (name) => `tests/integration/${name}.test.ts`,
          )
        : ["tests/integration/*.test.ts"];
    await runTests(
      [
        "--import",
        "tsx",
        "--import",
        "./tests/workflow/server-only.mjs",
        "--test",
        "--test-concurrency=1",
        ...specs,
      ],
      env,
    );
  } else {
    await runTests(
      [resolve("node_modules/@playwright/test/cli.js"), "test", ...process.argv.slice(3)],
      env,
    );
  }
} finally {
  cleanup();
}
