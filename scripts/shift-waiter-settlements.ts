import { shiftWaiterSettlementsBackOneDay } from "../src/lib/waiter/waiter-settlement-date-shift";

function usage(message?: string): never {
  if (message) console.error(message);
  console.error("Usage: npm run waiter-balances:shift-date -- --date=YYYY-MM-DD [--apply]");
  process.exit(1);
}

const args = process.argv.slice(2);
const dateArgument = args.find((argument) => argument.startsWith("--date="));
const apply = args.includes("--apply");
const unknownArgument = args.find(
  (argument) => argument !== "--apply" && !argument.startsWith("--date="),
);
if (unknownArgument || !dateArgument || args.filter((argument) => argument.startsWith("--date=")).length !== 1) {
  usage(unknownArgument ? `Unknown option: ${unknownArgument}` : "Provide exactly one --date option.");
}

const sourceBusinessDateKey = dateArgument.slice("--date=".length);

async function main() {`r`n  try {
  const result = await shiftWaiterSettlementsBackOneDay({
    sourceBusinessDateKey,
    apply,
  });
  console.log(`Source date: ${result.sourceBusinessDateKey}`);
  console.log(`Target date: ${result.targetBusinessDateKey}`);
  console.log(`Eligible settlements: ${result.candidateShiftIds.length}`);
  console.log(`Incomplete source records: ${result.incompleteShiftIds.length}`);
  console.log(`Target-date conflicts: ${result.conflictingShiftIds.length}`);

  if (result.incompleteShiftIds.length || result.conflictingShiftIds.length) {
    console.error("No changes were made because the correction is blocked.");
    process.exitCode = 1;
  } else if (result.applied) {
    console.log(`Committed: moved ${result.candidateShiftIds.length} settlement(s).`);
  } else {
    console.log("Dry run only. Re-run with --apply after reviewing this result.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Settlement shift failed.");
  process.exitCode = 1;`r`n  }`r`n}`r`n`r`nvoid main();`r`n