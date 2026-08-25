/**
 * The community guidelines and the terms both parties accept.
 *
 * TERMS_VERSION is stored on the subscriber and booking rows at the moment of
 * acceptance. Bump it whenever the text below changes materially, so a dispute
 * can be judged against the wording each party actually saw.
 */
export const TERMS_VERSION = '2026-08-21';

export type GuidelineSection = {
  id: string;
  title: string;
  body: string[];
};

export const GUIDELINES: GuidelineSection[] = [
  {
    id: 'who',
    title: 'Who HelloNeighbor is for',
    body: [
      'HelloNeighbor connects neighbors with people in their area who offer small services — taking out trash cans, washing a car, walking a dog, tutoring, yard work. Most are teenagers; anyone 14 or older can offer services.',
      'Providers under 18 are labelled with their age on their booking page. Their prices are lower and their availability works around school — a customer should know that before booking, and it is not a fault to be hidden.',
      'Everyone who offers services is reviewed by a person before their listing goes live. That review is a basic sanity check, not a background check, and it is not a guarantee of anything.',
    ],
  },
  {
    id: 'not-offered',
    title: 'What we do not allow',
    body: [
      'Babysitting and any other care of children, elderly people, or people who need medical or personal assistance. These carry risks this platform is not built to manage, and they are not available on HelloNeighbor.',
      'Anything requiring a license, certification, or insurance — electrical, plumbing, roof work, driving passengers, handling medication.',
      'Work that involves ladders above standing height, power tools, chemicals beyond ordinary household cleaning products, or entering a home when nobody else is there.',
      'Anything illegal, and anything involving alcohol, tobacco, vaping products, weapons, or cannabis.',
    ],
  },
  {
    id: 'communication',
    title: 'Keep all communication in the app',
    body: [
      'Every message between a neighbor and a service provider must go through HelloNeighbor. Do not move to text, DMs, or a phone call to arrange work, change a price, or settle a problem.',
      'This is the single most important safety rule here. In-app messages are timestamped and kept, which means that if something goes wrong there is a record of what was actually agreed.',
      'If a conversation happened somewhere else, we cannot see it, and we cannot use it to help resolve a dispute. A dispute opened over off-app arrangements will generally be closed without a finding.',
      'Never share your home address, school, or full schedule beyond what a specific booking requires.',
    ],
  },
  {
    id: 'safety',
    title: 'Safety expectations',
    body: [
      'If you are under 16, a parent or guardian must approve your account before it goes live. Under 18, they must know about every booking you accept, and should know where you are and when you expect to be done.',
      'Work outdoors or in a visible, public part of a property wherever possible.',
      'Anyone may cancel a booking at any time, for any reason or none, without penalty. Leaving a situation that feels wrong is always the right call — you do not owe anyone an explanation.',
      'Do not accept a booking that asks you to do something outside the service you listed.',
    ],
  },
  {
    id: 'payment',
    title: 'Payment',
    body: [
      'The price shown at booking is the price. Do not renegotiate off-app.',
      'For card payments, the amount is authorized when the booking is made and charged only after the provider marks the job complete.',
      'For cash and app-to-app transfers, HelloNeighbor records what was agreed but does not hold, transfer, or guarantee the money. That is between the two of you.',
    ],
  },
  {
    id: 'disputes',
    title: 'Disputes',
    body: [
      'Either side can open a dispute on a booking. An administrator reviews the booking record and the in-app messages, then decides how the payment is settled.',
      'That decision covers the payment for that booking and nothing else. HelloNeighbor does not adjudicate damages, injuries, or anything beyond the amount held for that job.',
    ],
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: [
      'HelloNeighbor is a listing and scheduling tool. We are not an employer, agency, contractor, or supervisor of anyone who offers services here, and we do not direct or control the work.',
      'To the fullest extent permitted by law, HelloNeighbor is not liable for any injury, harm, loss, or damage to any person or to any property — belonging to a neighbor, to a service provider, or to anyone else — arising from a booking, a service performed or not performed, or any interaction between users of this app.',
      'We do not run background checks, verify identity documents, confirm insurance, or inspect any property. Approval of a listing means a person glanced at it, nothing more.',
      'Each person using HelloNeighbor is responsible for their own conduct and their own safety, and for deciding whether a particular booking is appropriate for them.',
    ],
  },
];

/** The specific statements a user ticks. Each is stored as part of acceptance. */
export const OPERATOR_ACKNOWLEDGEMENTS = [
  'I have read the community guidelines and agree to follow them.',
  'I understand HelloNeighbor is not responsible for any harm, injury, or damage to people or property arising from a booking.',
  'I will keep all communication with neighbors inside the app.',
  'If I am under 16, my parent or guardian will be emailed to approve this account before it goes live. If I am under 18, they will know about my bookings.',
];

// The customer's ticks moved to lib/liability.ts (CUSTOMER_WAIVER) when the
// terms became a signed document with its own version stamp. Kept out of this
// file deliberately: two lists of customer acknowledgements is an invitation to
// wire up the weaker one by mistake.

/**
 * What a parent or guardian confirms before an under-18 account can be
 * approved. Lives here rather than in lib/guardian.ts so the consent form,
 * a client component, can import it without pulling in server-only code.
 */
export const GUARDIAN_ACKNOWLEDGEMENTS = [
  'I am the parent or legal guardian of this person, I am over 18, and I have the legal authority to make this decision for them.',
  'I give permission for them to offer services and accept bookings on HelloNeighbor.',
  'I take full responsibility for their activity in this app — the bookings they accept, the people they meet through it, and the work they do.',
  'I understand HelloNeighbor does not run background checks on anyone, does not supervise any work, and is not responsible for any injury, harm, or damage to people or property arising from a booking.',
  'I understand I am responsible for knowing where they are and what bookings they accept, and that I can withdraw this permission at any time.',
];

/**
 * The extra line shown when a guardian link is standing in for a failed or
 * skipped face check. It asks the guardian to confirm the age as a fact they
 * are attesting to, which is the whole point of the fallback.
 */
export const GUARDIAN_AGE_ATTESTATION =
  'I confirm this is their true age. I understand HelloNeighbor is relying on my word for it, and that giving a false age here puts my own child at risk.';
