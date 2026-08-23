// Canonical unit resolution for Israeli invoice lines.
//
// Two prices may only be pooled when they are quoted on the same basis. A ₪/kg
// price and a ₪/carton price for the same product differ by ~10x, and no
// statistic — median included — can absorb that: the result is a number that is
// wrong for everybody. So a line whose basis cannot be resolved is never
// benchmarked.

const KG   = /^(ק"?ג|קג|קילו|קילוגרם|kg)$/i;
const GRAM = /^(גרם|גר'?|ג'|g)$/i;
const LITER= /^(ליטר|ל'?|l|liter)$/i;
const ML   = /^(מ"?ל|מל|ml)$/i;
const UNIT = /^(יח'?|יחידה|יחידות|unit|pc|pcs|ea)$/i;

// Package-level units. These are NOT a basis — a "carton" is not a quantity
// until you know what is inside it.
const PACKAGE = /^(קרטון|ארגז|מארז|אריזה|חבילה|מגש|שק|דלי|תבנית|משטח|בקבוק|פחית|קופסה|צנצנת|גלון)$/;

function canonicalUnit(raw) {
  const u = (raw || '')
    .normalize('NFKC')
    .replace(/[֑-ׇ‎‏]/g, '')
    .replace(/["'`´׳״]/g, '"')
    .trim();

  if (!u) return null;                 // unknown — caller must not benchmark
  if (KG.test(u) || GRAM.test(u)) return 'kg';
  if (LITER.test(u) || ML.test(u)) return 'l';
  if (UNIT.test(u)) return 'unit';
  if (PACKAGE.test(u)) return null;    // not a comparable basis
  return null;
}

module.exports = { canonicalUnit };
