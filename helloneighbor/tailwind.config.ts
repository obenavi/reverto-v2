import type { Config } from 'tailwindcss';

/**
 * Green, white and blue.
 *
 * Blue leads because it is the colour of the frame — headers, links, the
 * things that are HelloNeighbor rather than the neighbourhood. Green is for
 * things that went right: a completed job, a verified account, a check-in.
 * White is most of the page, and doing most of the work.
 *
 * The two chromatics are deliberately far apart in hue. Somebody glancing at a
 * phone in sunlight has to tell "done" from "tap here" without reading, and
 * adjacent hues fail that.
 *
 * Every text pairing here clears WCAG AA against its own background, and every
 * control border clears 1.4.11 — checked by tests/palette.test.mjs, not
 * assumed. A young person reading a curfew warning on a phone outdoors is
 * exactly who a low-contrast palette fails.
 *
 * Base font size is 14px and spacing is on an 8px unit — see globals.css.
 */
const config: Config = {
  // lib/ is scanned because the category colours live on the service catalog
  // — Tailwind only compiles classes it can see as literal strings, so the
  // tone strings have to be written out where the data is.
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.ts'],
  theme: {
    extend: {
      colors: {
        // The frame: headers, links, primary actions.
        brand: {
          DEFAULT: '#1565C0',
          dark: '#0D47A1',
          light: '#E3F0FC',
        },
        // Things that went right. Deep enough to read as text on white.
        success: { DEFAULT: '#1B7A3E', dark: '#14602F', light: '#E4F4EA' },
        // Kept amber rather than made green or blue: a warning that shares a
        // hue with the rest of the palette stops reading as a warning.
        warning: { DEFAULT: '#8A5200', light: '#FDF2E0' },
        danger: { DEFAULT: '#A32D2D', light: '#FBEAEA' },
        // faint is still 4.5:1 on the page ground. It reads as secondary
        // because it is lower contrast than ink, not because it is unreadable —
        // hint text under an input is where a wrong answer actually costs you.
        ink: { DEFAULT: '#14202B', muted: '#5A6B7B', faint: '#667584' },
        // Decorative dividers. Not used for anything a person has to see.
        line: '#DCE5EC',
        // Inset panels — a copyable code, an inactive tab, a progress track.
        // Blue-cast rather than neutral grey, so it belongs to the same family
        // as everything else on the page.
        mist: '#EAF0F6',

        // --- Category accents -------------------------------------------
        // One hue per kind of work, so a grid of services reads as a grid of
        // different things before anybody reads a word of it. Two of the six
        // are brand and success rather than new hues: the palette should feel
        // like it has range, not like a paint chart.
        //
        // These live in their own layer. They are always shown with an icon
        // and a label, so they only have to be told apart from EACH OTHER —
        // unlike warning and danger, which have to be told apart from
        // everything. Their floor is 30° of hue separation, not 60°.
        teal: { DEFAULT: '#0B6F6F', light: '#E2F2F2' },
        // The green that survives on a blue ground. Brand green against brand
        // blue is 1.07:1 — invisible — so anything green inside the hero, or
        // on the app icon, is this instead.
        mint: '#6FD79C',
        violet: { DEFAULT: '#6A3FA0', light: '#F0EAFA' },
        berry: { DEFAULT: '#A8327D', light: '#FBE9F3' },
        // Input borders, which a person does have to see: 3:1 per WCAG 1.4.11.
        field: '#8492A0',
        // A hair of blue in the page ground, so white cards lift off it.
        canvas: '#F7FAFC',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        base: ['14px', '1.5'],
      },
      borderRadius: {
        btn: '8px',
        card: '12px',
      },
      maxWidth: {
        app: '720px',
      },
    },
  },
  plugins: [],
};

export default config;
