import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { supabaseAdmin } from './supabase';
import { GUIDELINES } from './guidelines';
import type { ModerationSubject, ModerationVerdict } from './types';

/**
 * The supervisor agent. Every signup, service listing, and booking note is
 * checked against the community guidelines before it becomes visible.
 *
 * Scope note: this reviews CONTENT. It can catch a listing that offers banned
 * work, a bio that funnels people off-app, contact details smuggled into a
 * free-text field, and copy that reads as machine-generated. It cannot prove
 * a signup came from a human — nothing reading a text field can. Real bot
 * defense is rate limiting plus a challenge (Turnstile/hCaptcha) at the form,
 * which belongs in front of this, not inside it.
 */

const MODEL = 'claude-opus-5';

const ReviewSchema = z.object({
  verdict: z
    .enum(['pass', 'review', 'block'])
    .describe(
      'pass = clearly fine. review = a human should look before this goes live. block = plainly violates the guidelines.'
    ),
  risk_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('0 = no concern at all, 100 = certain, serious violation.'),
  categories: z
    .array(
      z.enum([
        'banned_service',
        'childcare',
        'licensed_work',
        'off_platform_contact',
        'personal_info_exposure',
        'payment_circumvention',
        'adult_or_illegal',
        'harassment_or_hate',
        'spam_or_advertising',
        'likely_automated',
        'age_inconsistency',
        'other',
      ])
    )
    .describe('Every category that applies. Empty when the verdict is pass.'),
  automation_suspicion: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'How much the writing reads as machine-generated or copy-pasted spam rather than a real person. A signal, not proof of identity.'
    ),
  rationale: z
    .string()
    .describe('One or two plain sentences an administrator can act on.'),
});

export type SupervisorReview = z.infer<typeof ReviewSchema>;

function rulesDigest(): string {
  return GUIDELINES.map(
    (section) => `## ${section.title}\n${section.body.map((b) => `- ${b}`).join('\n')}`
  ).join('\n\n');
}

const SYSTEM_PROMPT = `You review user-submitted content for HelloNeighbor, a marketplace where people offer small services to their neighbors. Providers are 14 or older, with no upper limit: some are teenagers earning their first money, some are adults with a trade or a spare afternoon. Judge every listing by the same rules.

These are the community guidelines you enforce:

${rulesDigest()}

Judge only the content you are given, against those guidelines.

Be specific about what is wrong and where. Weigh the fact that many users are minors writing casually — informal spelling, short bios, and enthusiasm are normal and are not violations. An adult writing more formally is not thereby more trustworthy, and a professional-sounding listing is not exempt from any rule. Reserve "block" for content that plainly breaks a rule, most importantly:
- offering childcare, babysitting, or care of elderly or dependent people, under any wording
- offering licensed or hazardous work
- steering people off the app to text, DM, or call
- publishing a home address, school name, or full daily schedule
- anything adult, illegal, or hateful

Use "review" when something is uncertain, oddly specific about a minor's whereabouts, or reads as bulk-generated. Use "pass" for ordinary listings.

For automation_suspicion, weigh signals like generic marketing voice, keyword stuffing, implausible breadth of services, boilerplate phrasing, or text that looks templated. You cannot verify identity — score the writing, not the person.`;

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function isSupervisorConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * Reviews a piece of content and records the result. Never throws: a failed
 * review is written as an 'error' row for an admin to pick up, because losing
 * a signup to a transient API blip is worse than reviewing it late.
 */
export async function reviewContent(input: {
  subjectType: ModerationSubject;
  subjectId: string;
  label: string;
  content: Record<string, unknown>;
}): Promise<{ verdict: ModerationVerdict; review: SupervisorReview | null }> {
  const db = supabaseAdmin();

  async function record(
    verdict: ModerationVerdict,
    review: SupervisorReview | null,
    rationale: string
  ) {
    const { error } = await db.from('moderation_reviews').insert({
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      verdict,
      risk_score: review?.risk_score ?? 0,
      categories: review?.categories ?? [],
      rationale,
      model: MODEL,
    });
    if (error) console.error('[supervisor] could not record review', error);
  }

  if (!isSupervisorConfigured()) {
    // Fail open, but leave a trail — an unreviewed listing is still live.
    await record('review', null, 'Supervisor not configured (ANTHROPIC_API_KEY unset).');
    return { verdict: 'review', review: null };
  }

  try {
    const response = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: {
        format: zodOutputFormat(ReviewSchema),
        effort: 'low',
      },
      messages: [
        {
          role: 'user',
          content: `Review this ${input.label}:\n\n${JSON.stringify(input.content, null, 2)}`,
        },
      ],
    });

    const review = response.parsed_output;
    if (!review) {
      await record('error', null, 'Supervisor returned no parsable verdict.');
      return { verdict: 'error', review: null };
    }

    // A strong automation signal is worth a human look even when the content
    // itself reads as harmless.
    const verdict: ModerationVerdict =
      review.verdict === 'pass' && review.automation_suspicion >= 70 ? 'review' : review.verdict;

    const rationale =
      verdict !== review.verdict
        ? `${review.rationale} (Escalated: automation suspicion ${review.automation_suspicion}/100.)`
        : review.rationale;

    await record(verdict, review, rationale);
    return { verdict, review };
  } catch (err) {
    console.error('[supervisor] review failed', err);
    await record(
      'error',
      null,
      `Supervisor call failed: ${err instanceof Error ? err.message : 'unknown error'}`
    );
    return { verdict: 'error', review: null };
  }
}

/** Fire-and-forget wrapper for paths that must not wait on a review. */
export function reviewInBackground(input: Parameters<typeof reviewContent>[0]): void {
  void reviewContent(input).catch((err) => console.error('[supervisor] background', err));
}
