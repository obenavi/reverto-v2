/**
 * The pure half of lib/escalation.ts.
 *
 * Split out because escalation.ts imports lib/sms.ts, which imports the Twilio
 * SDK, which needs node's `net` — and the emergency-contacts panel is a client
 * component. Importing the constants from there dragged Twilio into the
 * browser bundle and broke the production build.
 *
 * This is the third time a client component has pulled a server-only package
 * through a transitive import (next/headers, then supabase-js, now Twilio), so
 * tests/client-imports.test walks the import graph and fails on the next one.
 * Nothing in this file may import anything server-side.
 */

export const MAX_EMERGENCY_CONTACTS = 3;

export const CONTACT_RELATIONSHIPS = [
  { value: 'parent', label: 'Parent' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'sibling', label: 'Brother or sister' },
  { value: 'aunt_uncle', label: 'Aunt or uncle' },
  { value: 'neighbor', label: 'Neighbor' },
  { value: 'other', label: 'Someone else' },
] as const;

export type EscalationTrigger = 'safety_report' | 'no_check_out' | 'panic' | 'manual';

export type EscalationTarget = {
  contacted: 'guardian' | 'emergency_contact' | 'admin' | 'operator';
  name: string | null;
  phone: string;
};

/** What each trigger says. Short, because it is read on a lock screen. */
export function escalationMessage(args: {
  trigger: EscalationTrigger;
  youngPersonName: string;
  where: string | null;
  when: string | null;
}): string {
  const at = args.where ? ` at ${args.where}` : '';

  switch (args.trigger) {
    case 'panic':
      return `${args.youngPersonName} pressed the help button on HelloNeighbor${at}${args.when ? `, ${args.when}` : ''}. Call them now. If they are in danger, call 911 — we cannot send anyone.`;
    case 'safety_report':
      return `${args.youngPersonName} reported a safety problem on a HelloNeighbor booking${at}. Please check on them.`;
    case 'no_check_out':
      return `${args.youngPersonName} started a HelloNeighbor job${at} and has not marked it finished. It may be nothing — please check on them.`;
    default:
      return `Something needs your attention on ${args.youngPersonName}'s HelloNeighbor account. Please open the app.`;
  }
}

