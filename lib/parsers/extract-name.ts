/**
 * Best-effort merchant name extraction from bank/card statement descriptions.
 * Returns null if nothing meaningful can be extracted.
 *
 * Strategy:
 *   1. Split on 2+ consecutive spaces (Amex uses this to separate merchant from suburb)
 *   2. Take the first segment
 *   3. Stop before the first pure number (store code / street number)
 *   4. Strip trailing punctuation / backslashes
 *   5. Title-case the result
 */
export function extractMerchantName(description: string): string | null {
  if (!description?.trim()) return null;

  // Step 1: cut at first multi-space gap
  const segment = description.split(/\s{2,}/)[0].trim();

  // Step 2: stop at first pure-number token (store code, address number)
  const words = segment.split(/\s+/);
  const kept: string[] = [];
  for (const word of words) {
    if (/^\d+$/.test(word)) break;
    kept.push(word);
  }

  // Step 3: clean up trailing backslash / punctuation
  const raw = kept.join(' ').replace(/[\\\/,]+$/, '').trim();
  if (!raw || raw.length < 2) return null;

  // Step 4: title-case
  return raw
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
