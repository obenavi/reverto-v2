/**
 * The private safety note must never be readable outside the admin path.
 *
 * A young person writes "he watched me the whole time and it felt wrong" on
 * the promise that the person it is about will never see it. That promise is
 * kept by one thing: nothing selects the column. A future `select('*')` on
 * customer_reviews would break it silently, with no error and no failing
 * behaviour — which is exactly the kind of thing a static check is for.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Where a reviewer is meant to read it. Nowhere else may. */
const ALLOWED_READERS = ['app/api/admin/'];

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — ${detail}`}`);
};

const files = walk(ROOT);
const offenders = [];
const wildcards = [];

for (const file of files) {
  const rel = file.slice(ROOT.length);
  const src = readFileSync(file, 'utf8');
  if (ALLOWED_READERS.some((prefix) => rel.startsWith(prefix))) continue;

  // Selecting the column by name outside the admin path.
  for (const match of src.matchAll(/\.select\(\s*(['"`])([\s\S]*?)\1/g)) {
    const columns = match[2];
    if (/\bprivate_note\b/.test(columns)) offenders.push(`${rel}: selects private_note`);
    // A wildcard on this table would pull it in without naming it.
    if (columns.trim() === '*' && /customer_reviews/.test(src)) {
      wildcards.push(`${rel}: select('*') in a file that touches customer_reviews`);
    }
  }
}

check('nothing outside the admin path selects private_note', offenders.length === 0, offenders.join('; '));
check('no wildcard select in a file touching customer_reviews', wildcards.length === 0, wildcards.join('; '));

// And the reason it is safe has to still be written down, so the next person
// does not remove the column from a query thinking it is dead weight.
const dbSrc = readFileSync(join(ROOT, 'lib/customerDb.ts'), 'utf8');
check('the reason is documented where the query lives', dbSrc.includes('private_note is deliberately not selected'));

console.log(`\n${files.length} source files scanned`);
console.log(failures === 0 ? 'all passed' : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
