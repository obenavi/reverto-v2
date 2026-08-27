/**
 * Which state a US postal code is in.
 *
 * Used to check a claimed state against the zip somebody typed, rather than
 * trusting a dropdown. It answers "is this plausible", not "is this true" — the
 * honest version of address verification without a geocoder.
 *
 * ## Ranges, not a lookup table
 *
 * ZIP prefixes are allocated to states in contiguous blocks, so sixty-odd
 * ranges cover the country. A per-prefix table would be a thousand hand-typed
 * entries, and a wrong one would send somebody's booking to the wrong child
 * labor law with no way to notice.
 *
 * ## What it is not
 *
 * A handful of prefixes genuinely straddle a state line, and a range table
 * cannot see that. So a mismatch is a flag, never a refusal on its own — the
 * account is held for a person to look at, and somebody who really does live on
 * the county line is not locked out by a table.
 */

type Range = { from: number; to: number; state: string };

/** Sorted by `from`. Overlaps would make the first match arbitrary. */
const RANGES: Range[] = [
  { from: 500, to: 599, state: 'NY' },
  { from: 600, to: 999, state: 'PR' },
  { from: 1000, to: 2799, state: 'MA' },
  { from: 2800, to: 2999, state: 'RI' },
  { from: 3000, to: 3899, state: 'NH' },
  { from: 3900, to: 4999, state: 'ME' },
  { from: 5000, to: 5999, state: 'VT' },
  { from: 6000, to: 6999, state: 'CT' },
  { from: 7000, to: 8999, state: 'NJ' },
  { from: 9000, to: 9999, state: 'AE' },
  { from: 10000, to: 14999, state: 'NY' },
  { from: 15000, to: 19699, state: 'PA' },
  { from: 19700, to: 19999, state: 'DE' },
  { from: 20000, to: 20099, state: 'DC' },
  { from: 20100, to: 20199, state: 'VA' },
  { from: 20200, to: 20599, state: 'DC' },
  { from: 20600, to: 21999, state: 'MD' },
  { from: 22000, to: 24699, state: 'VA' },
  { from: 24700, to: 26999, state: 'WV' },
  { from: 27000, to: 28999, state: 'NC' },
  { from: 29000, to: 29999, state: 'SC' },
  { from: 30000, to: 31999, state: 'GA' },
  { from: 32000, to: 34999, state: 'FL' },
  { from: 35000, to: 36999, state: 'AL' },
  { from: 37000, to: 38599, state: 'TN' },
  { from: 38600, to: 39799, state: 'MS' },
  { from: 39800, to: 39999, state: 'GA' },
  { from: 40000, to: 42799, state: 'KY' },
  { from: 43000, to: 45999, state: 'OH' },
  { from: 46000, to: 47999, state: 'IN' },
  { from: 48000, to: 49999, state: 'MI' },
  { from: 50000, to: 52999, state: 'IA' },
  { from: 53000, to: 54999, state: 'WI' },
  { from: 55000, to: 56799, state: 'MN' },
  { from: 57000, to: 57999, state: 'SD' },
  { from: 58000, to: 58899, state: 'ND' },
  { from: 59000, to: 59999, state: 'MT' },
  { from: 60000, to: 62999, state: 'IL' },
  { from: 63000, to: 65899, state: 'MO' },
  { from: 66000, to: 67999, state: 'KS' },
  { from: 68000, to: 69399, state: 'NE' },
  { from: 70000, to: 71499, state: 'LA' },
  { from: 71600, to: 72999, state: 'AR' },
  { from: 73000, to: 74999, state: 'OK' },
  { from: 75000, to: 79999, state: 'TX' },
  { from: 80000, to: 81699, state: 'CO' },
  { from: 82000, to: 83199, state: 'WY' },
  { from: 83200, to: 83899, state: 'ID' },
  { from: 84000, to: 84799, state: 'UT' },
  { from: 85000, to: 86599, state: 'AZ' },
  { from: 87000, to: 88499, state: 'NM' },
  { from: 88500, to: 88599, state: 'TX' },
  { from: 88900, to: 89899, state: 'NV' },
  { from: 90000, to: 96199, state: 'CA' },
  { from: 96700, to: 96899, state: 'HI' },
  { from: 97000, to: 97999, state: 'OR' },
  { from: 98000, to: 99499, state: 'WA' },
  { from: 99500, to: 99999, state: 'AK' },
];

export type ZipState =
  | { known: true; state: string }
  /** A real-looking zip in an unallocated block, or not a zip at all. */
  | { known: false };

export function stateForZip(zip: string | null | undefined): ZipState {
  if (!zip) return { known: false };

  const digits = zip.trim().replace(/[^0-9]/g, '').slice(0, 5);
  if (digits.length !== 5) return { known: false };

  const n = Number(digits);
  for (const range of RANGES) {
    if (n >= range.from && n <= range.to) return { known: true, state: range.state };
  }
  return { known: false };
}

export type ZipStateMatch = 'match' | 'mismatch' | 'unknown';

/**
 * Whether a claimed state is plausible for this zip.
 *
 * 'unknown' when the zip is not in an allocated block, which is a real thing
 * and must not be treated as a lie.
 */
export function zipMatchesState(
  zip: string | null | undefined,
  claimed: string | null | undefined
): ZipStateMatch {
  const found = stateForZip(zip);
  if (!found.known) return 'unknown';
  if (!claimed) return 'unknown';
  return found.state === claimed.trim().toUpperCase() ? 'match' : 'mismatch';
}
