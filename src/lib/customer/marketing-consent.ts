export function marketingConsentChange(
  currentlyConsented: boolean,
  intent: string,
  now = new Date(),
) {
  if (intent !== "opt-in" && intent !== "withdraw")
    return { ok: false as const, message: "Choose a valid email preference." };
  if (currentlyConsented === (intent === "opt-in"))
    return { ok: true as const, changed: false as const, data: null };
  return {
    ok: true as const,
    changed: true as const,
    data:
      intent === "opt-in"
        ? { marketingEmailConsentAt: now, marketingEmailRevokedAt: null }
        : { marketingEmailConsentAt: null, marketingEmailRevokedAt: now },
  };
}
