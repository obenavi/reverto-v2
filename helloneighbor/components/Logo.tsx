/**
 * The HelloNeighbor mark: two houses, one partly behind the other.
 *
 * Two of them rather than one, because a single house is a real-estate logo and
 * the whole idea here is the person next door. The near house is brand blue and
 * the far one green — the two colours the app runs on.
 *
 * The windows are holes in the path, not white rectangles, so the mark drops
 * onto any background without carrying a white ghost around with it. That is
 * also why `mono` exists: on a brand-coloured band, blue-on-blue disappears.
 *
 * Blue and green in this palette sit at nearly the same lightness (5.75 and
 * 5.38 against white), so where the two houses meet there is a real geometric
 * gap. Abutting them would read as one grey-brown blob.
 */

type Props = {
  /** Pixel size of the square mark. Legible down to 16. */
  size?: number;
  /**
   * 'color' for light backgrounds; 'mono' inherits the surrounding text colour,
   * which is what you want on a brand-coloured band.
   */
  tone?: 'color' | 'mono';
  className?: string;
  /**
   * Null when the name is already written next to the mark — otherwise a screen
   * reader reads "HelloNeighbor" twice.
   */
  label?: string | null;
};

/** Near house, with its window as an inner subpath. */
const FRONT = 'M3 31 L20 11 L30.4 27 L30.4 53 L8 53 L8 31 Z M14 36 H23 V45 H14 Z';
/** Far house, its left eave cut where the near one covers it. */
const BACK = 'M33.6 28.2 L45 16 L61 31 L56 31 L56 53 L33.6 53 Z M41 38 H49 V46 H41 Z';

export function LogoMark({
  size = 28,
  tone = 'color',
  className,
  label = 'HelloNeighbor',
}: Props) {
  const mono = tone === 'mono';
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fillRule="evenodd"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={FRONT} fill={mono ? 'currentColor' : '#1565C0'} />
      <path d={BACK} fill={mono ? 'currentColor' : '#1B7A3E'} />
    </svg>
  );
}

/** The mark plus the name, for headers and anywhere the app introduces itself. */
export function Logo({
  size = 26,
  tone = 'color',
  className,
}: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <LogoMark size={size} tone={tone} label={null} />
      <span
        className={`text-lg font-extrabold tracking-tight ${
          tone === 'mono' ? 'text-current' : 'text-brand'
        }`}
      >
        Hello<span className={tone === 'mono' ? '' : 'text-success'}>Neighbor</span>
      </span>
    </span>
  );
}
