/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("child_process");

const children = [];
let shuttingDown = false;

function runProcess(command) {
  const child = spawn(command, [], {
    stdio: "inherit",
    shell: true,
  });
  children.push(child);
  child.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    for (const proc of children) {
      if (proc.pid && proc.pid !== child.pid && !proc.killed) {
        proc.kill("SIGINT");
      }
    }
    process.exit(code ?? 0);
  });
  return child;
}

runProcess("npm run dev:ws");
runProcess("npm run dev:next");

function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }
  setTimeout(() => process.exit(0), 200);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.stdin.resume();
