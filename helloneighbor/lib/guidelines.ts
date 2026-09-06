/**
 * The community guidelines and the terms both parties accept.
 *
 * TERMS_VERSION is stored on the subscriber and booking rows at the moment of
 * acceptance. Bump it whenever the text below changes materially, so a dispute
 * can be judged against the wording each party actually saw.
 */
export const TERMS_VERSION = '2026-09-06';

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
      'HelloNeighbor connects neighbors with people in their area who offer small services — taking out trash cans, washing a car, walking a dog, tutoring, cutting hair, yard work. Anyone 14 or older can offer services here. Plenty are teenagers earning their first money; plenty are adults with a skill and some spare hours, and the rules are the same for both.',
      'Age is stated, not sorted by. A provider under 18 is labelled with their age on their booking page, because their prices are usually lower and their availability works around school, and a customer should know that before booking rather than after. Nobody is ranked above anybody for being older.',
      'Everyone who offers services is read by a person before their listing goes live. That review is a basic sanity check, not a background check, and it is not a guarantee of anything.',
    ],
  },
  {
    id: 'offering',
    title: 'Offering your own thing',
    body: [
      'You are not limited to the list. Name whatever you are good at — haircuts, car detailing, sports training, guitar lessons, bike repairs, photography, help with a laptop — and it becomes something neighbors can book.',
      'Every listing is read before it goes live: automatically first, then by a person if there is any doubt. Until somebody has read it, it is saved but not bookable. That is not a comment on you; it is how a listing gets to exist at all.',
      'Some things are refused outright and no amount of rewording changes it. The list below is what those are, and the principle underneath it is one idea: this app does not let anyone take sole responsibility for a person who cannot look after themselves.',
    ],
  },
  {
    id: 'not-offered',
    title: 'What we do not allow',
    body: [
      'Babysitting and any other care of children, elderly people, or people who need medical or personal assistance. This is the rule with no exceptions and no upper age limit — an adult may not offer it here any more than a fifteen-year-old may. Being wrong once, in that job, is unrecoverable.',
      'Coaching and lessons are a different thing and are fine, including with somebody’s child: every booking happens either at your place or at theirs with them home for the whole of it, so a tennis lesson for an eight-year-old happens with their parent in the house. That is a lesson, not custody.',
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
    title: 'Payment — no money passes through HelloNeighbor',
    body: [
      'HelloNeighbor is a place to find each other and agree a time. It is not a payment service. There is no card button, no wallet, no balance, no escrow and no payout, and there is no version of this app where your money sits with us.',
      'You pay the person who did the work, directly — cash, or an app you already use such as Venmo, Cash App, Zelle or PayPal. The app records which method you agreed and the amount, and that is the whole of our involvement.',
      'Starting costs nothing. The free plan covers one service and two bookings a week, with no card and no end date — enough to find out whether your street will book you. You only pay if you want past those limits.',
      'The only money HelloNeighbor ever takes from anyone is the monthly subscription a provider pays for the tools once they are past the free plan — their booking page, their schedule, their messages. It is a fee for software. It is not a commission, not a booking fee, not a cut of anyone\u2019s work, and it buys no insurance.',
      'Because we hold nothing, we cannot take a payment, release one, refund one, reverse one, or hold one back while an argument runs. If somebody does not pay, the money is owed to the other person and is theirs to chase.',
      'The price shown at booking is the price. Do not renegotiate off-app.',
      'Payment is handed over in person, when the job is done and you are both there. Never before. Nobody on HelloNeighbor may ask to be paid up front, and a provider who asks you to send money before they turn up is either breaking these guidelines or is not who they say they are — do not send it, and report them.',
      'When you book you tick every way you could pay them, and they pick one of those.',
      'Not paying somebody who did the work is a breach of these guidelines. We cannot make you pay — we never held the money — but the provider can mark the booking unpaid with their evidence, and an account that does it can be warned, suspended or closed.',
      'Either of you can mark a booking as paid in the app and attach a screenshot or a photo of the receipt. That is a record of what you each say happened, kept in case it is ever needed. It is not us confirming anything, because we are not in a position to.',
    ],
  },
  {
    id: 'presence',
    title: 'Somebody is always there',
    body: [
      'Every booking is one of two things: it happens at the provider’s own place, or it happens at yours and you — or another adult — are there for the whole of it. You say which when you book. There is no third option and no way to book one.',
      'This does not depend on how old the provider is. A young person alone inside a stranger’s house is exposed, and so is a householder who let a stranger in and went out. Neither of those stops being true the day somebody turns eighteen.',
      'Do not leave a key, a gate code, or an unlocked door for a provider to let themselves in, and do not arrange it in the messages either. It is a breach of these guidelines and grounds for closing an account.',
      'A provider can leave, at any point, if they turn up and nobody is there. They do not owe anyone an explanation for that and they should say so in the messages.',
    ],
  },
  {
    id: 'disputes',
    title: 'Disputes',
    body: [
      'Either side can open a dispute on a booking. An administrator reads the booking record, the in-app messages and whatever proof both sides attach, and decides one thing: what happens to the accounts involved — nothing, a warning, a suspension, or closure.',
      'We cannot decide money, and that is not us refusing to help: we never held any. There is nothing for us to release, refund or withhold, and a decision from us moves nothing between you. Anything owed between the two of you stays between the two of you, and small claims court exists for exactly that.',
      'HelloNeighbor does not adjudicate damages or injuries either. On written request we will give you your own booking record and the messages from it, which is usually what a court asks to see.',
    ],
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: [
      'HelloNeighbor is a listing and scheduling tool and nothing else. We are not an employer, agency, contractor, or supervisor of anyone who offers services here; we do not direct or control the work; and we do not handle the money for it. Every agreement about a job — what is done, when, for how much, and whether it was done well — is between the two people who made it.',
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
  'I understand HelloNeighbor is only a platform: customers pay me directly, no money for a job ever passes through the app, and the only money HelloNeighbor takes is my subscription. If someone does not pay me, chasing it is mine to do.',
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
