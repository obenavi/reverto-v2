// Cold product matching — reduces a free-text Hebrew invoice description to a
// coarse "cold key" so that prices for the same base product can be pooled.
//
// The deliberate design choice: grade, variety, brand, trim, cut, flavour,
// packaging and origin are ALL discarded. אורז יסמין and אורז עגול both become
// אורז; תפוח גרני סמית and תפוח זהוב both become תפוח. Pooling that widely makes
// buckets big enough to benchmark at all, and the MEDIAN — never the mean —
// absorbs the spread between grades, because a handful of premium or bargain
// variants cannot drag the middle value the way they would drag an average.
//
// Precision is intentionally traded for coverage. A bucket is a rough answer to
// "what do restaurants pay for rice", not a like-for-like quote.

// ── Character-level normalization ────────────────────────────────────────────
const NIQQUD       = /[֑-ׇ]/g;            // vowel points + cantillation
const BIDI_MARKS   = /[‎‏‪-‮⁦-⁩]/g;  // OCR injects these constantly
const QUOTES       = /[׳״'"`´׳״]/g;        // geresh, gershayim, ASCII quotes
const FINAL_LETTERS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

// ── Tokens that describe a VARIANT, not a product ────────────────────────────
// Anything here is stripped before the head noun is chosen. Order is irrelevant;
// every token is removed wherever it appears.
const MODIFIERS = new Set([
  // state / preparation
  'טרי','טריה','טריים','קפוא','קפואה','קפואים','מוקפא','מוקפאים','מבושל','מבושלת',
  'מעושן','מעושנת','צלוי','אפוי','מיובש','מיובשת','חי','נא','שלם','שלמה','שלמים',
  'קלוף','קלופה','קלופים','חתוך','חתוכה','פרוס','פרוסה','פרוסות','קצוץ','טחון','טחונה',
  'מגורד','מגוררת','שטוף','נקי','מסונן','סחוט',
  // grade / quality
  'מעולה','משובח','פרימיום','איכות','דרג','סוג','א','ב','ג','מובחר','מיוחד','רגיל','סטנדרט',
  'כתית','זך','מזוכך','מלא','דל','רזה','שמן','דק','גס','עדין',
  // certification
  'אורגני','אורגנית','בדץ','רבנות','מהדרין','כשר','כשרה','גלאט','פרווה','חלבי','בשרי',
  'ללא','גלוטן','טבעוני','דיאט',
  // origin
  'מיובא','מיובאת','יבוא','מקומי','מקומית','הארץ','תוצרת','ישראלי','ישראלית','חול',
  // packaging
  'ארוז','ארוזה','ארוזים','תפזורת','שק','שקית','קרטון','מארז','אריזה','חבילה','מגש',
  'דלי','גלון','בקבוק','פחית','קופסה','צנצנת','ואקום','שקוף','יחידה','יח','יחידות',
  'קג','ק','גרם','גר','ליטר','ל','מל','מיל','סמק','אינץ','מ','ס',
  // commercial noise
  'למסעדות','מסעדות','לעסקים','חדש','מבצע','הנחה','כולל','ללא','עם','בתוספת','בטעם',
  'ב','ל','של','את','מן','מ','ה','ו','נ','ט'
]);

// ── Head-noun canonicalization ───────────────────────────────────────────────
// Maps inflected / spelling-variant forms onto one canonical head noun. Keys are
// matched AFTER character normalization and final-letter folding.
const LEMMA = new Map(Object.entries({
  // produce
  'עגבניה':'עגבניות','עגבניות':'עגבניות','עגבנייה':'עגבניות','עגבניות':'עגבניות',
  'מלפפון':'מלפפונים','מלפפונים':'מלפפונים',
  'בצל':'בצל','בצלים':'בצל',
  'גזר':'גזר','גזרים':'גזר',
  'תפוח':'תפוח','תפוחים':'תפוח','תפוחי':'תפוח',
  'תפוא':'תפוח אדמה','תפוד':'תפוח אדמה',
  'לימון':'לימון','לימונים':'לימון',
  'חסה':'חסה','חסות':'חסה',
  'פלפל':'פלפל','פלפלים':'פלפל',
  'בטטה':'בטטה','בטטות':'בטטה',
  'כרוב':'כרוב','כרובית':'כרובית','ברוקולי':'ברוקולי','ברוקול':'ברוקולי',
  'חציל':'חציל','חצילים':'חציל',
  'קישוא':'קישואים','קישואים':'קישואים',
  'שום':'שום','סלק':'סלק','דלעת':'דלעת','דלורית':'דלעת',
  'אבוקדו':'אבוקדו','בננה':'בננה','בננות':'בננה','אבטיח':'אבטיח','מלון':'מלון',
  'ענב':'ענבים','ענבים':'ענבים','תות':'תות','תותים':'תות','אגס':'אגס','אגסים':'אגס',
  'אפרסק':'אפרסק','אשכולית':'אשכולית','אשכוליות':'אשכולית','תפוז':'תפוז','תפוזים':'תפוז',
  'בזיליקום':'בזיליקום','פטרוזיליה':'פטרוזיליה','כוסברה':'כוסברה','נענע':'נענע',
  // proteins
  'עוף':'עוף','חזה':'חזה עוף','שוק':'שוק עוף','ירך':'שוק עוף','כנפיים':'כנפי עוף',
  'בקר':'בקר','אנטריקוט':'אנטריקוט','סינטה':'סינטה','פילה':'פילה',
  'טלה':'טלה','כבש':'טלה','הודו':'הודו',
  'סלמון':'סלמון','לברק':'לברק','דניס':'דניס','טונה':'טונה','דג':'דג','דגים':'דג',
  'שרימפס':'שרימפס','שרימפ':'שרימפס','קלמרי':'קלמרי','קלמארי':'קלמרי',
  'סרטן':'סרטן','מולים':'מולים','מול':'מולים','סקלופ':'סקלופ',
  // dairy / eggs
  'ביצה':'ביצים','ביצים':'ביצים','חלב':'חלב','שמנת':'שמנת','חמאה':'חמאה',
  'גבינה':'גבינה','גבינת':'גבינה','לבנה':'לבנה','יוגורט':'יוגורט','קוטג':'קוטג',
  'מוצרלה':'מוצרלה','פרמזן':'פרמזן','צהובה':'גבינה צהובה','ברינזה':'גבינה',
  // dry goods
  'אורז':'אורז','קמח':'קמח','סוכר':'סוכר','מלח':'מלח','פסטה':'פסטה','ספגטי':'פסטה',
  'עדשים':'עדשים','חומוס':'חומוס','שעועית':'שעועית','קינואה':'קינואה','בורגול':'בורגול',
  'שמן':'שמן','חומץ':'חומץ','סויה':'סויה','קטשופ':'קטשופ','מיונז':'מיונז','חרדל':'חרדל',
  'טחינה':'טחינה','שומשום':'שומשום','פירורי':'פירורי לחם','לחם':'לחם','פיתה':'פיתה'
}));

function stripChars(s) {
  return (s || '')
    .normalize('NFKC')
    .replace(NIQQUD, '')
    .replace(BIDI_MARKS, '')
    .replace(QUOTES, '')
    .replace(/[()\[\]{}.,;:!?\/\\|+*=_~<>@#$%^&-]/g, ' ')
    .replace(/\d+(\.\d+)?/g, ' ')      // sizes, pack counts, weights
    .replace(/[a-zA-Z]+/g, ' ')        // latin brand fragments
    .replace(/\s+/g, ' ')
    .trim();
}

function foldFinals(s) {
  return s.replace(/[\u05da\u05dd\u05df\u05e3\u05e5]/g, ch => FINAL_LETTERS[ch] || ch);
}

// Lemma lookup is done on the folded form, so 'סלמון' and 'סלמונ' both hit the
// same entry. Values stay unfolded so they read correctly in Hebrew.
const FOLDED_LEMMA = new Map();
for (const [k, v] of LEMMA) FOLDED_LEMMA.set(foldFinals(k), v);

// Reduces a raw description to a matching key plus a human-readable label.
//   key   — folded, canonical; group on this, never display it
//   label — what to show the operator
// Returns key '' when nothing usable survives (pure noise / non-product lines).
function coldKey(rawName) {
  const cleaned = stripChars(rawName);
  if (!cleaned) return { key: '', label: '', tokens: [] };

  const tokens = cleaned.split(' ')
    .filter(t => t.length > 1 && !MODIFIERS.has(foldFinals(t)));

  if (!tokens.length) return { key: '', label: '', tokens: [] };

  // Hebrew places the noun before its adjectives, so the first surviving token
  // is the head: "עגבניות שרי אדומות" heads on עגבניות. A known head is mapped to
  // its canonical form; an unknown one becomes its own bucket, which keeps
  // unrecognised products grouped with their own kind instead of merged wrongly.
  const head = tokens[0];
  const canonical = FOLDED_LEMMA.get(foldFinals(head));

  return {
    key: foldFinals(canonical || head),
    label: canonical || head,
    tokens
  };
}

module.exports = { coldKey, stripChars, foldFinals, MODIFIERS, LEMMA };
