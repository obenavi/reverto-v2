import { MINOR_BADGE_LIMIT } from '@/lib/ages';

/**
 * Says plainly that a provider is under 18.
 *
 * Now that adults can operate too, a customer comparing two listings is
 * comparing different things — and the honest framing is that the lower price
 * comes with a teenager's schedule and a teenager's experience. Hiding that
 * would be the actual problem; saying it up front sets expectations and is
 * fairer to the young person than a disappointed customer.
 */
export function isYoungProvider(age: number): boolean {
  return age < MINOR_BADGE_LIMIT;
}

export function YoungProviderPill({ age }: { age: number }) {
  if (!isYoungProvider(age)) return null;
  return (
    <span className="pill bg-warning-light text-warning">🌱 {age} years old</span>
  );
}

export function YoungProviderNotice({ name, age }: { name: string; age: number }) {
  if (!isYoungProvider(age)) return null;

  return (
    <div className="rounded-card border-l-4 border-warning bg-warning-light p-3">
      <p className="text-[13px] font-bold text-warning">
        🌱 What booking {name} at {age} means
      </p>
      <ul className="mt-1 space-y-1 text-[13px] text-ink-muted">
        <li>
          Prices are lower than a professional service, and the work reflects that — this
          is a young person building a reputation, not a licensed contractor.
        </li>
        <li>
          Availability works around school. Expect afternoons, weekends, and the occasional
          change of plan.
        </li>
        <li>
          {age < 16
            ? 'A parent or guardian has approved this account and knows about their bookings.'
            : 'Be around, or have an adult around, while the work is happening.'}
        </li>
      </ul>
    </div>
  );
}
