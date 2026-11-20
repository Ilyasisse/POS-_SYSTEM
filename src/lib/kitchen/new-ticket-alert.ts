export function unseenTicketIds(
  seenIds: ReadonlySet<string>,
  currentTickets: readonly { id: string }[],
): string[] {
  return currentTickets.flatMap((ticket) =>
    seenIds.has(ticket.id) ? [] : [ticket.id],
  );
}

export function playNewTicketTone(context: AudioContext) {
  const start = context.currentTime;
  for (const [index, frequency] of [660, 880].entries()) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const time = start + index * 0.16;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.06, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.15);
  }
}
