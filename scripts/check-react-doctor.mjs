import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scanner = fileURLToPath(
  new URL("../node_modules/react-doctor/bin/react-doctor.js", import.meta.url),
);
const result = spawnSync(
  process.execPath,
  [
    scanner,
    "--scope",
    "full",
    "--json",
    "--json-compact",
    "--blocking",
    "none",
    "--no-cache",
    "--yes",
  ],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);

function verifyReport(result) {
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("React Doctor did not return a valid JSON report.");
  }

  if (result.status !== 0 || report?.ok !== true) {
    throw new Error(report?.error?.message ?? "React Doctor scan failed.");
  }

  if (
    report.schemaVersion !== 3 ||
    report.mode !== "full" ||
    report.reactDetected !== true ||
    report.diff !== null ||
    !Array.isArray(report.projects) ||
    report.projects.length === 0 ||
    (report.skippedProjects?.length ?? 0) > 0 ||
    report.projects.some(
      (project) =>
        project.complete !== true ||
        !(project.analyzedFileCount > 0) ||
        project.analyzedFileCount !== project.scannedFileCount ||
        project.skippedChecks?.length !== 0,
    )
  ) {
    throw new Error("React Doctor did not complete the full scan.");
  }

  for (const diagnostic of report.diagnostics) {
    console.log(
      `${diagnostic.filePath}:${diagnostic.line} ${diagnostic.plugin}/${diagnostic.rule} ${diagnostic.message}`,
    );
  }

  const score = report.summary?.score;
  if (
    typeof score !== "number" ||
    report.projects.some((project) => typeof project.score?.score !== "number")
  ) {
    throw new Error("React Doctor did not report a numeric score for the full scan.");
  }
  if (score !== 100) {
    throw new Error(`React Doctor scored ${score}/100. This check requires 100/100.`);
  }
  console.log("React Doctor scored 100/100.");
}

try {
  verifyReport(result);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
