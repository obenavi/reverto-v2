import type { ReportReason } from './types';

/**
 * Reporting and blocking exist because an app carrying user-generated content
 * needs them — App Store Guideline 1.2 asks for a filter, a report path, a
 * block, and a published contact. The filter is the supervisor agent; these
 * are the other two.
 */

export const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  {
    value: 'safety',
    label: 'I felt unsafe',
    hint: 'Something about this person or situation worried you.',
  },
  {
    value: 'harassment',
    label: 'Harassment or bullying',
    hint: 'Threats, insults, or repeated unwanted contact.',
  },
  {
    value: 'inappropriate',
    label: 'Inappropriate content',
    hint: 'Sexual, violent, or otherwise not okay — especially toward a minor.',
  },
  {
    value: 'scam',
    label: 'Scam or no-show',
    hint: 'Took payment and did not do the work, or asked for money oddly.',
  },
  {
    value: 'off_platform',
    label: 'Pushing me off the app',
    hint: 'Asking to text, call, or arrange payment outside HelloNeighbor.',
  },
  {
    value: 'underage',
    label: 'Concern about someone’s age',
    hint: 'You think an account misstates who is actually using it.',
  },
  { value: 'spam', label: 'Spam', hint: 'Advertising or junk.' },
  { value: 'other', label: 'Something else', hint: 'Tell us in your own words.' },
];

export function reasonLabel(value: ReportReason): string {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}

/**
 * Reasons that mean someone may be in danger. These jump the admin queue and
 * are what the response-time promise in the guidelines is really about.
 */
export const URGENT_REASONS: ReportReason[] = ['safety', 'inappropriate', 'underage'];

export function isUrgent(reason: ReportReason): boolean {
  return URGENT_REASONS.includes(reason);
}

/** What we promise, and what the admin queue is measured against. */
export const RESPONSE_TARGET_HOURS = 24;
