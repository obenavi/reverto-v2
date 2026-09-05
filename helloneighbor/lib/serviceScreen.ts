/**
 * The floor under a provider-written service.
 *
 * Anybody may propose work this app has never heard of — haircuts, car
 * detailing, bike repair, guitar lessons — and the supervisor model in
 * lib/supervisor.ts is what actually judges whether a listing is acceptable.
 * This module is the thing underneath that: a deterministic refusal for the
 * categories that must never pass, whatever anyone writes and whatever the
 * model thinks.
 *
 * ## Why have both
 *
 * A keyword list is easy to walk around. "Looking after little ones while you
 * pop out" contains none of the words below, and a model reading it refuses
 * instantly. So this is not the filter — it is the floor, and it earns its
 * place by being the one part of the stack that:
 *
 *   - cannot be talked round, because it does not reason;
 *   - refuses identically every time, so two people writing the same thing get
 *     the same answer;
 *   - works when the model is down, misconfigured, or answering slowly.
 *
 * The order is blocklist, then model, then a person. A listing that clears the
 * blocklist is not approved — it is merely not obviously banned.
 *
 * ## What is blocked, and the principle behind it
 *
 * One idea: sole responsibility for a person who cannot look after themselves.
 * Babysitting is the obvious case, but so is walking a six-year-old to school,
 * so is sitting with somebody's grandmother, and so is anything where the job
 * IS the supervision of a human being. Around that sit the categories where an
 * ordinary mistake maims somebody — ladders, gas, pools, pesticide, cars with
 * passengers in them.
 *
 * Coaching a child is deliberately NOT in that set, and the reason is
 * structural rather than a judgement call: every booking on this platform
 * happens either at the provider's own place or at the customer's with the
 * customer home for the whole of it (lib/presence.ts). A tennis lesson for
 * somebody's eight-year-old therefore happens with their parent in the house.
 * That is a lesson, not custody. If the presence rule is ever relaxed, this
 * paragraph stops being true and coaching has to move into the blocked set.
 */

export type BlockedCategory =
  | 'care_of_a_person'
  | 'transport'
  | 'licensed_or_hazardous'
  | 'heights_or_machinery'
  | 'chemicals_or_pests'
  | 'water'
  | 'weapons'
  | 'age_restricted_goods'
  | 'medical'
  | 'intimate'
  | 'overnight';

type Rule = {
  category: BlockedCategory;
  /** Said to the provider. Explains the rule, not just the refusal. */
  why: string;
  patterns: RegExp[];
};

/**
 * Word-boundary matching throughout: "care" must not fire on "car care", and
 * "sit" must not fire on "site". Where a single word is too broad on its own
 * the pattern requires its neighbours.
 */
const RULES: Rule[] = [
  {
    category: 'care_of_a_person',
    why: 'Looking after a person — a child, an older adult, anyone who needs help to be safe — is not something this app allows anyone to offer, at any age. It is the one job where being wrong once is unrecoverable.',
    patterns: [
      /\bbaby ?sit(ter|ting|s)?\b/,
      /\bchild ?(care|minder|minding|sitting)\b/,
      /\bnann(y|ies)\b/,
      /\bau pair\b/,
      /\bday ?care\b/,
      /\bcreche\b/,
      /\bnurser(y|ies)\b/,
      // The verb does not always take a preposition — "watching children after
      // school" has none — so the preposition is optional and the OBJECT is
      // what the rule turns on. That is also what keeps it off "watching the
      // dog" and "looking after your garden".
      /\b(look(ing)? after|watch(ing)?|mind(ing)?|car(e|ing) for|sit(ting)? for|supervis(e|ing)|tend(ing)? to)\s+(your |my |the |their |a |an |some )?(kid|kids|child|children|baby|babies|toddler|toddlers|infant|infants|little one|little ones|son|daughter|grand ?(ma|pa|mother|father)|mum|mom|dad|elderly|senior|seniors|parent|parents)\b/,
      /\b(elder|senior|adult|personal|respite|companion) ?care\b/,
      /\bcare ?giver\b/, /\bcarer\b/,
      /\bsitting (with|for) (your|my|the|an|a) (kid|child|children|baby|elderly|grandma|grandpa|mother|father)\b/,
      /\b(walk|walking|take|taking|drop|dropping|pick|picking) .{0,20}\b(to|from) school\b/,
      /\bschool run\b/,
      /\bpotty training\b/, /\bbath(ing)? (your|the|a) (kid|child|baby|children)\b/,
      /\bdiaper|nappy|nappies\b/,
      /\bbedtime\b/, /\bput .{0,15}\bto bed\b/,
    ],
  },
  {
    category: 'transport',
    why: 'Driving anyone anywhere is not allowed here. It needs a licence, insurance this app does not check, and it takes both people somewhere nobody else knows about.',
    patterns: [
      /\b(drive|driving|driver|chauffeur|ride ?share|uber|lyft|taxi|carpool|car ?pool)\b/,
      /\b(give|giving|offer|offering) (you |them |a )?(a )?(lift|ride)s?\b/,
      /\b(transport|transporting|ferry|ferrying) (people|passengers|kids|children|you|them)\b/,
      /\bdesignated driver\b/,
      /\bmoving (van|truck) (service|hire)\b/,
    ],
  },
  {
    category: 'licensed_or_hazardous',
    why: 'Trades that need a licence are not offered here. Not because of skill — because the licence is what an insurer and a court look for when something goes wrong.',
    patterns: [
      /\belectric(al|ian)\b/, /\brewir(e|ing)\b/, /\bfuse ?box\b/, /\bconsumer unit\b/,
      /\bplumb(er|ing)\b/, /\bboiler\b/, /\bgas (fitting|fitter|safe|appliance)\b/,
      /\bhvac\b/, /\bfurnace\b/, /\bair ?con(ditioning)? (install|repair|service)\b/,
      /\broof\b/, /\broof(er|ing|s)\b/, /\bchimney\b/, /\bstructural\b/, /\basbestos\b/,
      /\bdemolition\b/, /\bscaffold(ing)?\b/, /\bwelding\b/,
      /\blegal advice\b/, /\btax (advice|return|preparation)\b/, /\bfinancial advice\b/,
    ],
  },
  {
    category: 'heights_or_machinery',
    why: 'Anything above standing height or with a motor on it is out. A fall from a ladder is the single most common way somebody doing this kind of work ends up in hospital.',
    patterns: [
      /\bladder(s)?\b/, /\bgutter(s| cleaning| clearing)\b/, /\bon the roof\b/,
      /\btree (surgery|felling|removal|cutting|climbing)\b/, /\bchainsaw\b/,
      /\bwood ?chipper\b/, /\bpower ?wash(er|ing)? (the )?roof\b/,
      /\bcherry picker\b/, /\bscissor lift\b/,
      /\bride ?on mower\b/, /\bstump grind(er|ing)\b/,
    ],
  },
  {
    category: 'chemicals_or_pests',
    why: 'Anything stronger than ordinary household cleaning products is out, and so is anything to do with pests. Both need training and protective equipment this app cannot check anyone has.',
    patterns: [
      /\bpest control\b/, /\bexterminat(or|ing|e)\b/, /\bfumigat(e|ion|ing)\b/,
      /\bpesticide|herbicide|insecticide|rodenticide\b/,
      /\bmould|mold remediation\b/, /\bbleach(ing)? (the )?roof\b/,
      /\bacid wash\b/, /\bhazardous waste\b/, /\basbestos\b/,
      /\bwasp|hornet|bee (nest|removal)\b/,
    ],
  },
  {
    category: 'water',
    why: 'Anything to do with a pool or open water is out — the risk is drowning, and it is not a risk a booking note can manage.',
    patterns: [
      /\bpool (cleaning|maintenance|service|boy|attendant)\b/,
      /\bclean(ing)? (the |your |a )?(swimming )?pool\b/,
      /\blife ?guard(ing)?\b/, /\bswim(ming)? (lesson|instruction|teacher|coach)/,
      /\bhot ?tub (service|cleaning)\b/, /\bboat(ing)? (trip|tour|hire)\b/,
    ],
  },
  {
    category: 'weapons',
    why: 'Nothing involving weapons, at all.',
    patterns: [/\bfirearm|gun|rifle|shotgun|pistol|ammo|ammunition|knife sharpening|blade sharpening\b/],
  },
  {
    category: 'age_restricted_goods',
    why: 'Alcohol, tobacco, vapes and cannabis are out — buying them, delivering them, or being paid in them.',
    patterns: [
      /\balcohol|liquor|booze|beer run|wine (delivery|run)\b/,
      /\btobacco|cigarette|vap(e|ing)|nicotine\b/,
      /\bcannabis|weed delivery|marijuana|thc|cbd (sale|selling)\b/,
      /\bbar ?tend(er|ing)\b/,
    ],
  },
  {
    category: 'medical',
    why: 'Anything medical is out, including the parts that sound harmless. Giving somebody the wrong tablet is not a small mistake.',
    patterns: [
      /\bmedication|medicine (reminder|management)|pills?\b/,
      /\binjection|insulin|catheter|wound care|dressing changes?\b/,
      /\bphysio(therapy)?\b/, /\bchiropract(ic|or)\b/, /\bacupuncture\b/,
      /\bnurs(e|ing) (care|service|visit)\b/, /\bfirst aid (cover|service)\b/,
      /\bdiagnos(e|is|ing)\b/, /\btherap(y|ist) (session|for)\b/,
    ],
  },
  {
    category: 'intimate',
    why: 'Anything involving touch of that kind is out.',
    patterns: [
      /\bmassage\b/, /\bwax(ing)? (service|legs|body)\b/,
      /\bescort|sensual|erotic|adult (service|entertainment)\b/,
      /\bsugar (baby|daddy)\b/,
      /\bhelp(ing)? .{0,15}\b(shower|bathe|dress|undress|toilet)\b/,
    ],
  },
  {
    category: 'overnight',
    why: 'Nothing that runs overnight or involves staying at somebody’s house. Every booking here ends the same day it starts.',
    patterns: [
      /\bover ?night\b/, /\bhouse ?sit(ting|ter)?\b/, /\bstay(ing)? (over|the night)\b/,
      /\bsleep ?over\b/, /\blive ?in\b/, /\bnight shift\b/,
    ],
  },
];

export type ScreenResult =
  | { ok: true }
  | { ok: false; category: BlockedCategory; matched: string; message: string };

/**
 * Flattens the text somebody typed so trivial obfuscation does not walk past.
 *
 * Not an attempt at a full homoglyph defence — that is the model's job. This
 * handles the lazy cases: "b@bysitting", "child‑care" with a non-ASCII hyphen,
 * "BABY SITTING" in caps, doubled spaces.
 */
export function normalizeForScreening(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[‐-―−]/g, '-')
    .replace(/[0]/g, 'o')
    .replace(/[1|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The deterministic pass. Everything it refuses is refused for good. */
export function screenServiceText(...parts: (string | null | undefined)[]): ScreenResult {
  const text = normalizeForScreening(parts.filter(Boolean).join(' '));
  if (!text) return { ok: true };

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const hit = text.match(pattern);
      if (hit) {
        return {
          ok: false,
          category: rule.category,
          matched: hit[0],
          message: rule.why,
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Shown next to the field, so somebody knows what kind of thing fits before
 * they write one. Real examples beat a description of the rules.
 */
export const SERVICE_EXAMPLES = [
  'Haircuts and trims',
  'Car detailing, inside and out',
  'Tennis or football training',
  'Guitar or piano lessons',
  'Bike repairs and tune-ups',
  'Window cleaning, ground floor',
  'Dog grooming and baths',
  'Help setting up a phone or laptop',
  'Painting a fence',
  'Photography for an event',
  'Weeding and planting',
  'Moving furniture around the house',
];

/** The short version of what will never be allowed, for the same field. */
export const SERVICE_LIMITS = [
  'Looking after a person — children, older adults, anyone who needs help to be safe',
  'Driving anyone anywhere',
  'Anything needing a licence: electrical, plumbing, gas, roofing',
  'Ladders, roofs, chainsaws, anything above standing height',
  'Chemicals beyond ordinary cleaning products, and pests',
  'Pools and open water',
  'Anything medical, intimate, or overnight',
];
