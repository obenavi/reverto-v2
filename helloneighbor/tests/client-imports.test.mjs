/**
 * No client component may reach a server-only module.
 *
 * This has now happened three times, each the same shape and each invisible
 * until a production build failed or a library was silently shipped to
 * browsers:
 *
 *   lib/guardian -> lib/session -> next/headers   (broke the build)
 *   lib/parents  -> lib/supabase -> supabase-js   (shipped to the browser)
 *   lib/escalation -> lib/sms -> twilio -> net    (broke the build)
 *
 * Every time the cause was a client component importing two constants from a
 * module that also happens to hold server code. The fix each time was to split
 * the pure half into its own file. This walks the actual import graph from
 * every 'use client' file and fails on the next one, naming the path so the
 * split is obvious.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/** Packages and modules that must never end up in a browser bundle. */
const SERVER_ONLY = [
  'next/headers',
  'twilio',
  '@supabase/supabase-js',
  '@anthropic-ai/sdk',
  'stripe',
  'web-push',
  'resend',
  'crypto',
  'fs',
  'net',
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', 'tests'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const source = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

/**
 * Every import specifier that survives to runtime.
 *
 * `import type` and `export type` are erased by the compiler and genuinely
 * cannot reach a bundle, so following them would produce false positives that
 * teach people to ignore this check. A mixed statement — `import { type A, b }`
 * — is a value import and is followed.
 */
function importsOf(src) {
  const out = [];
  for (const m of src.matchAll(/(?:^|\n)\s*import\s+([\s\S]*?)from\s+['"]([^'"]+)['"]/g)) {
    if (/^type\s/.test(m[1].trim())) continue;
    out.push(m[2]);
  }
  for (const m of src.matchAll(/(?:^|\n)\s*export\s+([\s\S]*?)from\s+['"]([^'"]+)['"]/g)) {
    if (/^type\s/.test(m[1].trim())) continue;
    out.push(m[2]);
  }
  return out;
}

/** Resolve a local specifier to a file we have. */
function resolveLocal(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null;

  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && source.has(candidate)) return candidate;
  }
  return null;
}

/** Walks from a client file and returns the first path reaching a server-only module. */
function offendingPath(entry) {
  const seen = new Set();
  const queue = [[entry, [entry]]];

  while (queue.length > 0) {
    const [file, path] = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);

    for (const spec of importsOf(source.get(file) ?? '')) {
      const bare = spec.replace(/^node:/, '');
      if (SERVER_ONLY.some((s) => bare === s || bare.startsWith(`${s}/`))) {
        return [...path, spec];
      }
      const next = resolveLocal(spec, file);
      if (next) queue.push([next, [...path, next]]);
    }
  }
  return null;
}

let failures = 0;
const rel = (f) => f.slice(ROOT.length + 1);

const clientFiles = files.filter((f) => /^\s*['"]use client['"]/.test(source.get(f) ?? ''));
const offenders = [];

for (const file of clientFiles) {
  const path = offendingPath(file);
  if (path) offenders.push(path.map((p) => (p.startsWith('/') ? rel(p) : p)).join('\n       -> '));
}

if (offenders.length === 0) {
  console.log(`ok   no client component reaches a server-only module`);
} else {
  failures += offenders.length;
  for (const o of offenders) console.log(`FAIL ${o}`);
}

// The check is worthless if it cannot see any client components.
const enough = clientFiles.length >= 10;
console.log(`${enough ? 'ok  ' : 'FAIL'} found ${clientFiles.length} client components to check`);
if (!enough) failures += 1;

// And worthless if the resolver silently fails to follow local imports.
const followed = resolveLocal('@/lib/format', join(ROOT, 'components/BookingFlow.tsx'));
console.log(`${followed ? 'ok  ' : 'FAIL'} the resolver follows @/ imports`);
if (!followed) failures += 1;

console.log(`\n${clientFiles.length} client components, ${files.length} source files`);
console.log(failures === 0 ? 'all passed' : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
