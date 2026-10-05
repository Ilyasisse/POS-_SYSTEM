import { getPostHogClient } from "@/lib/posthog-server";

export const EQUAL_BILL_SPLITTING_FLAG = "equal-bill-splitting-admin-preview";

type StaffUser = { id: string; role: string };
type FlagEvaluator = (user: StaffUser) => Promise<boolean>;

async function evaluatePostHogFlag(user: StaffUser): Promise<boolean> {
  const posthog = getPostHogClient();
  if (!posthog) return false;

  const flags = await posthog.evaluateFlags(user.id, {
    flagKeys: [EQUAL_BILL_SPLITTING_FLAG],
    personProperties: { role: user.role },
  });
  return flags.isEnabled(EQUAL_BILL_SPLITTING_FLAG);
}

export async function canShowEqualBillSplit(
  user: StaffUser,
  evaluateFlag: FlagEvaluator = evaluatePostHogFlag,
): Promise<boolean> {
  if (user.role !== "ADMIN") return false;

  try {
    return (await evaluateFlag(user)) === true;
  } catch (error) {
    console.error("Could not evaluate equal bill splitting flag.", error);
    return false;
  }
}
