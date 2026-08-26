import { relationshipWord } from './parentRoles';

/**
 * The message a parent's cancellation sends to the customer.
 *
 * Two variants, because "she can't work Tuesday" and "she can't work Tuesday
 * between 2 and 6" leave the customer with very different options. Telling
 * someone to rebook "a different day" when the afternoon would have worked
 * loses a booking that did not need to be lost.
 *
 * Written in the parent's voice and signed by them. A customer who booked a
 * 15-year-old and gets a cancellation should be able to see immediately that
 * it came from the adult behind the account.
 */

export type CancellationScope = 'day' | 'hours';

function dayPhrase(startsAt: string, now: Date = new Date()): string {
  const start = new Date(startsAt);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(start) - startOfDay(now)) / 86_400_000);

  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `on ${start.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })}`;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function cancellationMessage(args: {
  parentName: string;
  childName: string;
  relationship: string;
  serviceTitle: string;
  startsAt: string;
  scope: CancellationScope;
  /** For 'hours': the window the young person cannot work. */
  unavailableFrom?: string;
  unavailableTo?: string;
  now?: Date;
}): string {
  const when = dayPhrase(args.startsAt, args.now);
  const at = timeOf(args.startsAt);
  const who = `This is ${args.parentName}. I'm ${args.childName}'s ${relationshipWord(
    args.relationship
  )}.`;

  if (args.scope === 'hours' && args.unavailableFrom && args.unavailableTo) {
    const from = timeOf(args.unavailableFrom);
    const to = timeOf(args.unavailableTo);
    return (
      `${who} Unfortunately ${args.childName} isn't available ${when} between ${from} and ${to}, ` +
      `so I have to cancel your ${args.serviceTitle} appointment at ${at}. ` +
      `If you'd like to reschedule you can pick another time ${when} outside those hours, or a different day. Thank you!`
    );
  }

  return (
    `${who} Unfortunately I have to cancel your appointment for ${args.serviceTitle} ${when} at ${at}. ` +
    `You can reschedule for a different day. Thank you!`
  );
}

/** Shown to the parent before anything is sent. Same caution the operator gets. */
export const CANCELLATION_WARNING =
  'Cancelling can cost your child this customer and can mean a bad review. If the booking can still go ahead — or if a different time that same day would work — that is almost always the better outcome.';
