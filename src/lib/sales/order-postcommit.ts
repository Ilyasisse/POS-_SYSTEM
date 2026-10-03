// Delivery failures must not turn a committed order into a failed checkout.
export async function runOrderPostCommitEffect(
  description: string,
  effect: () => void | Promise<unknown>,
) {
  try {
    await effect();
  } catch (error) {
    console.error(description, error);
  }
}
