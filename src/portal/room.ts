/**
 * Normalize a user room code into a Portal channel id `kitchen-<code>`.
 * Keeps only letters and digits, lowercased; length must be 4–12.
 */
export function toRoomId(code: string): string {
  const normalized = code.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (normalized.length < 4 || normalized.length > 12) {
    throw new Error(
      `Room code must yield 4–12 letters or digits after normalization (got ${normalized.length}).`,
    );
  }

  return `kitchen-${normalized}`;
}
