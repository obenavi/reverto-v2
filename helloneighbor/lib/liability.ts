/**
 * The agreement both sides sign, and the process it points at.
 *
 * ## Why this is its own file
 *
 * The community guidelines are advice. This is the part that is meant to have
 * legal effect, and it is signed separately, at a different moment, with its
 * own version stamp — so that when a dispute is judged we can say exactly
 * which words that person agreed to and when.
 *
 * ## What this can and cannot do — read before editing
 *
 * A release is not a force field, and writing it more aggressively does not
 * make it stronger. Three limits are real and no wording gets around them:
 *
 *   1. A parent cannot sign away their child's own claims. Pre-injury waivers
 *      of a minor's rights are unenforceable in a large number of states. The
 *      guardian's signature binds the guardian's claims. The young person's
 *      survive it, and they typically have until around age 20 to bring them.
 *
 *   2. Gross negligence and intentional harm cannot be waived anywhere. A
 *      clause that purports to cover them tends to be struck — and in some
 *      states it takes the rest of the release down with it. So clause 4 says
 *      so out loud, on purpose.
 *
 *   3. Undertaking to screen creates a duty to screen competently. Promising
 *      more than we do is worse than promising nothing, because it converts a
 *      marketing line into a standard we can be measured against. Every
 *      sentence here about what we check is deliberately narrow and every one
 *      of them is true.
 *
 * The clause that actually protects the operator of this app is not any of
 * these — it is the corporate structure and the insurance. This document
 * narrows who can sue for what. It does not stop anyone.
 *
 * NOT LEGAL ADVICE. This is a serious draft, not a reviewed instrument. It
 * needs a lawyer licensed in the state of operation before launch, and the
 * arbitration and damages clauses in particular vary enormously by state.
 */

/**
 * Bump whenever the words below change materially. Stored against every
 * acceptance so a dispute is judged against the text that person actually saw.
 */
export const LIABILITY_VERSION = '2026-08-25.2';


export type Clause = {
  n: number;
  title: string;
  /**
   * One sentence, rendered before the clause in plain language.
   *
   * Not decoration. A term that a court finds buried or incomprehensible is a
   * term that does not bind anyone — conspicuousness is part of enforceability,
   * and the summary is also simply the honest thing to give a fourteen-year-old
   * and their mother.
   */
  plain: string;
  body: string[];
};

export const AGREEMENT: Clause[] = [
  {
    n: 1,
    title: 'Who these terms are between',
    plain: 'This is an agreement between you and HelloNeighbor. It is not an agreement between you and the person you book.',
    body: [
      '“HelloNeighbor”, “we” and “us” mean the company operating this app, its owners, officers, employees and contractors. “You” means anyone who uses HelloNeighbor in any way — browsing, booking, offering services, or holding a parent account.',
      '“Provider” means someone who lists services here. “Customer” means someone who books one. “Guardian” means a parent, legal guardian, or approved older sibling on a young person’s account. A single person can be more than one of these.',
      'These terms apply from the moment you use HelloNeighbor, whether or not you have an account. If you do not agree to them, do not use it.',
      'The agreement for any actual work is between the customer and the provider. We are not a party to it, we do not sign it, and we are not bound by it.',
    ],
  },
  {
    n: 2,
    title: 'What HelloNeighbor is',
    plain: 'We are a noticeboard with a calendar attached. Nothing more.',
    body: [
      'HelloNeighbor lists people near you who offer small services, lets you book a time, and keeps a record of what was said.',
      'We are not an employer, an employment agency, a staffing service, a contractor, a subcontractor, a broker, a supervisor, or a guarantor. We do not assign work. We do not set prices. We do not direct, control, oversee, inspect, or attend any job. We do not provide tools, equipment, transport, or training.',
      'Every provider on HelloNeighbor works for themselves as an independent party. Nothing in these terms or in how the app works creates an employment relationship, a partnership, a joint venture, an agency, or a franchise between HelloNeighbor and anyone.',
      'We do not monitor bookings in real time. Nobody is watching a job happen. Messages are recorded so they can be read later; they are not read as they are sent.',
    ],
  },
  {
    n: 3,
    title: 'What we check — and the much longer list of what we do not',
    plain: 'We do a few small checks. We do not run background checks on anyone, ever.',
    body: [
      'We do check: that a human read a listing before it went live; that a provider states an age of 14 or over; that anyone under 18 has an adult on their account; that a parent account holder has passed our adult check; that a young person’s stated age is not obviously implausible.',
      'We do NOT run criminal background checks, sex-offender registry checks, or any other criminal history check, on providers or on customers. Not at signup, not ever. If you assume we do, you are assuming wrong, and this sentence exists so you cannot later say you did not know.',
      'We do NOT verify anyone’s identity beyond the checks named above. We do not confirm names, addresses, employment, references, driving records, immigration status, or that a photo is of the person using the account.',
      'We do NOT confirm that anyone holds insurance, a licence, a certification, a permit, or any qualification. We do NOT inspect any home, yard, tool, ladder, chemical, vehicle, or animal.',
      'We do NOT supervise, quality-check, or guarantee any work, and we do not guarantee that anyone will turn up, finish, be competent, be honest, be sober, or be safe to be around.',
      'A listing being live means one person glanced at it and it did not obviously break our rules. It is not a recommendation, an endorsement, a vouching, a certification, or any statement about that person’s character or ability.',
      'You are the one deciding whether a particular booking is right for you, and if you have a guardian, they are deciding with you. Nothing here replaces your own judgement, and nothing here is a reason to skip it.',
    ],
  },
  {
    n: 4,
    title: 'Who may use HelloNeighbor',
    plain: 'Providers must be 14+. Customers and guardians must be 18+. One account each, and it is yours to look after.',
    body: [
      'You may offer services if you are 14 or over. If you are under 18, an adult — a parent, legal guardian, or a sibling aged 21 or over who has passed our adult check — must be on your account before it goes live, and may remove it at any time.',
      'You must be 18 or over to book a service or to hold a parent account. If you are under 18 and want to book something, an adult must do it.',
      'One account per person. Do not create an account for anyone else, share your login, let anyone else use your account, or make a new account after we have closed one of yours.',
      'Everything done through your account is treated as done by you. If you let someone else use it, what they do is your responsibility, not ours and not theirs.',
      'Tell us straight away if you think someone else has got into your account.',
    ],
  },
  {
    n: 5,
    title: 'You accept the risk',
    plain: 'Strangers coming to your home, or you going to a stranger’s home, is genuinely risky. You are choosing to do it.',
    body: [
      'Small jobs at private homes carry real risk. Someone can be injured or killed. Property can be damaged, lost, or stolen. A person can turn out to be dishonest, unreliable, intoxicated, aggressive, or dangerous. There may be dogs, unsafe steps, chemicals, tools, weather, other people in the house, or a car in the driveway.',
      'You know all of this and you are choosing to use HelloNeighbor anyway. You voluntarily assume all risk of using it — known risks, and risks nobody thought of.',
      'This includes risk from other people who happen to be present: household members, guests, neighbours, contractors, and anyone else at or near the address.',
      'If you are a guardian signing for a young person, you are assuming that risk on your own behalf as well, and you are the one deciding whether the work they are taking on is appropriate for them, at that address, at that time of day.',
    ],
  },
  {
    n: 6,
    title: 'Release of claims against us',
    plain: 'You give up your right to sue us over what happens on a booking. This does not cover us doing something reckless or deliberate — no release can.',
    body: [
      'To the fullest extent the law allows, you release, waive, and discharge HelloNeighbor from any and all claims, demands, actions, causes of action, liabilities, damages, costs, and expenses of any kind — known or unknown, present or future — arising out of or connected in any way with: a listing, a booking, a service performed or not performed, a payment, a cancellation, a message, a review, an interaction between users, or anything anyone does or fails to do in connection with HelloNeighbor.',
      'This includes claims for personal injury, illness, emotional distress, death, property damage, theft, loss, trespass, nuisance, defamation, harassment, discrimination, and economic loss.',
      'This release covers claims based on ordinary negligence, including any claim that we were negligent in designing the app, in reviewing a listing, in the checks we do or do not run, in matching people, or in how we handled a report or a dispute.',
      'This release does NOT cover our own gross negligence, recklessness, wilful misconduct, or fraud. It cannot, in any state. We say so plainly because a release that pretends to cover those things is more likely to be struck down entirely, taking the enforceable parts with it.',
      'If you are signing as a guardian: understand exactly what your signature does. It releases YOUR OWN claims. It does not release the young person’s. In many states a parent cannot sign away a minor’s right to sue for their own injuries, and that right generally survives until some time after they turn 18. We are telling you this rather than letting you believe otherwise.',
      'To the extent the law allows, you also waive any statute that would limit a general release to claims you know about at the time of signing — including California Civil Code § 1542 and any similar law in any other state.',
    ],
  },
  {
    n: 7,
    title: 'The service is provided as it is',
    plain: 'No promises about the app working, or about anyone on it being any good.',
    body: [
      'HelloNeighbor is provided “as is” and “as available”, with all faults and without warranty of any kind.',
      'To the fullest extent the law allows, we disclaim all warranties, express or implied — including any implied warranty of merchantability, fitness for a particular purpose, title, non-infringement, quiet enjoyment, accuracy, or any warranty arising from a course of dealing or trade usage.',
      'We do not warrant that HelloNeighbor will be available, uninterrupted, secure, accurate, or free of errors, or that any defect will be fixed; that any listing, price, review, photograph, or piece of information is true or complete; or that any provider or customer is safe, honest, competent, insured, or suitable for you.',
      'Some states do not allow certain warranties to be disclaimed. Where that is so, this clause applies as far as that state permits and no further.',
    ],
  },
  {
    n: 8,
    title: 'Keep everything in the app',
    plain: 'Message through HelloNeighbor or we cannot help you. This is the rule everything else depends on.',
    body: [
      'Every message about a booking — arranging it, changing it, agreeing a price, raising a problem, settling one — must go through HelloNeighbor. Not text message, not phone, not social media, not email, not in person without a message confirming it.',
      'In-app messages are timestamped and retained. If something goes wrong, there is a record of what was actually agreed, and that record is what a dispute is decided on.',
      'If a conversation happened somewhere we cannot see it, we cannot use it. A dispute that turns on an off-app arrangement will generally be closed without a finding — not because we disbelieve you, but because we have no way to know.',
      'Asking someone to move off the app to arrange work, change a price, or settle a problem is a violation of these terms and can get an account suspended or closed on its own.',
      'Do not share your home address, school, workplace, or full schedule beyond what a specific booking actually requires.',
    ],
  },
  {
    n: 9,
    title: 'Things you must not do',
    plain: 'The list of behaviour that gets an account closed.',
    body: [
      'Do not offer or request babysitting, childcare, eldercare, personal care, medical or nursing assistance, or supervision of anyone who needs looking after. These are not available on HelloNeighbor at any price.',
      'Do not offer or request work needing a licence, certificate, or insurance — electrical, plumbing, gas, roofing, tree felling, structural work, pest control, driving passengers, or handling medication.',
      'Do not offer or request work involving ladders above standing height, power tools, chemicals beyond ordinary household cleaning products, firearms, or entering a home when nobody else is there.',
      'Do not misrepresent your age, identity, or what you are offering. Do not use someone else’s photograph. Do not create an account for someone else.',
      'Do not harass, threaten, stalk, intimidate, defame, or discriminate against anyone. Do not send sexual content, and never anything sexual to or about a minor.',
      'Do not arrange anything involving alcohol, tobacco, vaping products, cannabis, or any illegal drug, and never in the presence of a minor.',
      'Do not use HelloNeighbor to recruit for another platform, to advertise, to scrape data, to send spam, to test security, to bypass any limit or check, or to build a competing service.',
      'Do not pay or accept payment outside what the booking says, to avoid our records or anyone’s taxes.',
      'Do not post a review that is dishonest, that you were paid to write, or that reveals someone’s address or personal details.',
    ],
  },
  {
    n: 10,
    title: 'Young people, and the adults responsible for them',
    plain: 'If you are the adult on a young person’s account, you are responsible for what they do here.',
    body: [
      'A provider under 18 must have a guardian on their account before it goes live. That guardian can see their bookings, set how late they may work, cancel a booking, and remove the account entirely.',
      'By becoming that guardian, you confirm you are over 18, that you have the authority to make this decision for them, and that you accept responsibility for their activity on HelloNeighbor — the bookings they take, the people they meet through it, and the work they do.',
      'You are responsible for knowing where they are going, when, and for how long. HelloNeighbor shows you their bookings; it does not watch over them and it is not a substitute for you doing so.',
      'A guardian may withdraw permission at any time, for any reason, which takes the account offline immediately.',
      'Customers are shown that a provider is under 18 before booking. If you book a young person, you accept that you are engaging a minor to come to your property, and everything that follows from that is your responsibility as the adult present.',
      'A provider under 18 may not be asked to work past 9pm, whatever anyone agrees between themselves, and their guardian may set an earlier limit.',
    ],
  },
  {
    n: 11,
    title: 'Money, and what we do not do with it',
    plain: 'For cash and payment apps, the money never touches us. We are not a bank, an escrow, or a payment processor.',
    body: [
      'The price shown at booking is the price. Renegotiating off-app is a violation of these terms.',
      'For cash and app-to-app transfers such as Venmo, Cash App or Zelle: HelloNeighbor records what was agreed and nothing more. We do not hold, transfer, escrow, insure, or guarantee that money. We are not a party to the payment, we are not a money transmitter, and we do not act as anyone’s agent for collecting it. If someone does not pay, that debt is owed to the other person, not to us, and it is theirs to pursue.',
      'For card payments, where offered, funds are handled by a third-party payment processor under that processor’s own terms. We do not store card numbers.',
      'Subscription fees paid to HelloNeighbor by providers are for access to the listing and scheduling tools. They are not a commission on work, they do not buy insurance, and they do not make us a party to any job.',
      'Every provider is responsible for their own taxes. We do not withhold tax, provide workers’ compensation, unemployment cover, health cover, sick pay, holiday pay, or any benefit of any kind, and nothing about paying us a subscription fee changes that.',
      'Fees already paid are not refundable except where we say so in writing or where the law requires it.',
    ],
  },
  {
    n: 12,
    title: 'If something goes wrong between you and the other person',
    plain: 'Talk in the app. If that fails, open a dispute with proof. We decide the money for that booking and nothing else.',
    body: [
      'First, try to sort it out in the app. Most problems are a misunderstanding about time, price, or what the job included, and a message fixes them.',
      'If that does not work, open a dispute on the booking. Say what happened, say what you want, and attach your proof — photographs, receipts, anything you have. Your messages are already on the record.',
      'The other person is told that a dispute has been opened and gets to give their side and attach their own proof before anything is decided.',
      'An administrator reads the booking, the messages, and both sides’ evidence, and decides one single thing: how the money for that booking is settled. That is the entire scope of what we decide.',
      'We do not decide who caused an injury. We do not value damaged property. We do not award compensation, damages, or costs. We are not a court, an arbitrator between users, an insurer, or an investigator. A finding from us is an administrative decision about a payment, and it is not a legal judgment about anything.',
      'Our decision on the payment is final as far as HelloNeighbor is concerned. It has no effect at all on what you may do next.',
    ],
  },
  {
    n: 13,
    title: 'Everything you can still do — and we do not stand in the way of any of it',
    plain: 'These terms limit what you can claim from us. They take nothing away from what you can claim from the other person.',
    body: [
      'Nothing in this agreement waives, limits, or affects any right or claim you have against the other user. Not one.',
      'You can call the police. You can bring a case in small claims court or any other court. You can hire a lawyer. You can claim on your own homeowners, renters, auto, or health insurance. You can report to a state agency. You can do all of it at once, and you do not need our permission, our finding, or our involvement to start.',
      'Ask us in writing and we will give you your own booking record and the messages from that booking, so you have them for whatever you decide to do. We will not charge you for that.',
      'We give records to law enforcement when they ask lawfully, and we do not need your permission to do so.',
      'If someone has been hurt or is in danger, call emergency services first. Reporting it to us is not a substitute — we are not an emergency service, we do not answer at night, and we cannot send anyone.',
    ],
  },
  {
    n: 14,
    title: 'What we do about people who cause harm',
    plain: 'We cannot compensate you, but we do act on accounts. Serious things skip the warning stage.',
    body: [
      'Ordinary problems escalate: a warning on the record, then a suspension, then a permanent closure. Being rude once and being rude repeatedly are different things.',
      'Serious matters do not escalate. Violence, threats, sexual conduct, weapons or drugs, and anything putting a young person at risk mean immediate suspension while a person reviews it, with no warning stage.',
      'A closure removes the listing, ends the ability to book or be booked, and blocks the same phone number and email from signing up again.',
      'We will tell you what action was taken on a report you made. We will not tell you anything else about the other person’s account, because that is theirs and telling you would invite retaliation.',
      'We report to law enforcement when we believe someone is in danger or that a crime has been committed, whether or not anyone asks us to.',
      'We may suspend or close any account at any time, with or without notice, if we believe it is necessary to protect someone. We do not have to prove anything to a standard of evidence first, and choosing to act quickly is not an admission that we were responsible for anything.',
    ],
  },
  {
    n: 15,
    title: 'There is no insurance here',
    plain: 'We do not insure anyone. There is no protection fund. Get your own cover.',
    body: [
      'HelloNeighbor does not provide, arrange, broker, or pay for any insurance covering any user, any job, any property, or any injury. There is no guarantee fund, no host protection programme, no damage cover, and no pot of money set aside for claims.',
      'If you have seen another platform advertise something like that, this is not that, and we are not it.',
      'Arrange your own cover if you want it. Homeowners and renters policies often cover damage caused by someone working at your home, and often exclude it — it is worth ten minutes to find out which yours does before you book.',
      'Providers: your parents’ homeowners policy may not cover you for work you are paid for. Assume it does not until someone tells you otherwise in writing.',
    ],
  },
  {
    n: 16,
    title: 'You cover us if your conduct causes us a problem',
    plain: 'If someone sues us because of something you did, you pay for that.',
    body: [
      'You agree to defend, indemnify, and hold HelloNeighbor harmless from any claim, demand, loss, liability, damage, fine, penalty, cost, or expense — including reasonable legal fees — arising out of or connected with: your use of HelloNeighbor; any service you performed or received; anything you posted or sent; your breach of these terms; your violation of any law; or your infringement of anyone’s rights.',
      'This survives the closing of your account.',
      'We may take over the defence of any such claim ourselves at your expense, and if we do you will cooperate with us. You may not settle anything in a way that admits fault on our behalf or obliges us to do anything, without our written agreement.',
    ],
  },
  {
    n: 17,
    title: 'The most we could ever owe you',
    plain: 'If we somehow owe you anything, it is capped at what you have paid us, or one hundred dollars.',
    body: [
      'To the fullest extent the law allows, our total liability to you for all claims, in aggregate, is limited to the greater of: the total fees you paid HelloNeighbor in the twelve months before the event giving rise to the claim, or one hundred United States dollars.',
      'We are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages; for lost profits, lost income, lost opportunity, lost data, or reputational harm; or for the cost of substitute services — whether or not we were told such losses were possible, and regardless of the legal theory used.',
      'These limits apply even if a remedy in these terms is found to have failed of its essential purpose.',
      'Some states do not allow some of these limits. Where that is so, this clause applies as far as that state permits and no further, and the rest of it still stands.',
    ],
  },
  {
    n: 18,
    title: 'Messages we send you',
    plain: 'You agree we can text you about your bookings. You can stop marketing texts any time.',
    body: [
      'By giving us your phone number, you agree that HelloNeighbor may send you text messages and push notifications about your account, your bookings, safety matters, disputes, and payments. These are service messages and are part of how the app works.',
      'Message and data rates may apply. Message frequency varies. Reply STOP to any message to stop marketing texts; we may still send messages necessary to operate your account or to reach you about a safety matter or a dispute.',
      'We may record and retain in-app messages indefinitely for safety, dispute resolution, and legal reasons, and both parties to a conversation are told this at the outset.',
      'We may contact a guardian about a young person’s account without that young person’s agreement. That is the point of a guardian being on the account.',
    ],
  },
  {
    n: 19,
    title: 'What you post',
    plain: 'You keep your photos and reviews. You let us show them.',
    body: [
      'You keep ownership of everything you post — listings, photographs, messages, reviews.',
      'You grant HelloNeighbor a worldwide, non-exclusive, royalty-free, transferable licence to host, store, reproduce, display, and distribute what you post, for the purpose of operating and promoting HelloNeighbor. This licence ends when you delete the content, except for copies retained in backups, in dispute records, or where the law requires us to keep them.',
      'You confirm you have the right to post what you post, that it is not someone else’s, and that it does not show a person who has not agreed to appear.',
      'Reviews must be honest and about your own experience. We may remove any content for any reason, including content that is untrue, abusive, reveals someone’s personal details, or breaks these terms. We are not obliged to remove anything, and choosing to remove one thing does not oblige us to review everything.',
    ],
  },
  {
    n: 20,
    title: 'Cancelling, and things nobody controls',
    plain: 'Anyone can cancel. Nobody is liable for weather, illness, or an app outage.',
    body: [
      'Either side may cancel a booking at any time, for any reason or none. Leaving a situation that feels wrong is always the right call and nobody here will hold it against you.',
      'A guardian may cancel a young person’s booking at any time.',
      'Neither we nor any user is liable for failure or delay caused by anything outside reasonable control — weather, illness, injury, power or network failure, a payment processor outage, strike, fire, flood, epidemic, act of government, or war.',
      'We may change, suspend, or discontinue any part of HelloNeighbor at any time. We may stop operating entirely. We are not liable to you for doing so.',
    ],
  },
  {
    n: 21,
    title: 'Ending your account',
    plain: 'You can leave whenever. We can close an account whenever. Some things outlive the account.',
    body: [
      'You may close your account at any time from your settings.',
      'We may suspend or terminate your access at any time, with or without notice or reason, including where we believe it protects someone or where you have broken these terms.',
      'When an account ends, bookings already made may be cancelled, and money owed between users remains owed between them.',
      'Clauses 5, 6, 7, 13, 16, 17, 22, 23 and any other clause that by its nature should continue will survive the ending of your account, indefinitely.',
      'We retain records after an account closes where we need them for disputes, safety, or the law. What we retain and for how long is set out in the privacy policy.',
    ],
  },
  {
    n: 22,
    title: 'Disagreements with us',
    plain: 'Claims against us go to individual arbitration, not court, and not as a class action. You can opt out within 30 days.',
    body: [
      'You and HelloNeighbor agree that any dispute between you and us — arising out of these terms, the app, or your use of it — will be resolved by binding individual arbitration, and not in court and not before a jury.',
      'YOU AND WE EACH WAIVE THE RIGHT TO A JURY TRIAL AND THE RIGHT TO PARTICIPATE IN A CLASS ACTION, CLASS ARBITRATION, OR ANY REPRESENTATIVE PROCEEDING. An arbitrator may award relief only to you individually.',
      'Either of us may still bring an individual claim in small claims court if it qualifies there, and either of us may seek an injunction in court to protect intellectual property.',
      'You may opt out of this arbitration clause entirely by emailing us within 30 days of first accepting these terms, saying so. Opting out changes nothing else about your account and we will not treat you differently for it.',
      'This clause is about claims against US. It has no effect on any claim you have against another user, which you may bring wherever you like.',
      'Before starting arbitration, tell us in writing what the dispute is and give us 30 days to try to sort it out. Most things end there.',
    ],
  },
  {
    n: 23,
    title: 'The legal fine print that actually matters',
    plain: 'If one clause is struck down, the rest still stand. That is the most important sentence in this document.',
    body: [
      'SEVERABILITY. If any part of these terms is found unenforceable, that part is limited or removed to the minimum extent necessary and everything else stays in full force. In particular, if a release or limitation is unenforceable as to one type of claim, one person, or one state, it remains fully enforceable as to every other.',
      'GOVERNING LAW. These terms are governed by the law of the state in which HelloNeighbor operates, without regard to conflict-of-law rules. Where arbitration does not apply, the courts of that state have exclusive jurisdiction.',
      'NO WAIVER. If we do not enforce something, that is not a waiver of it, and it does not stop us enforcing it later or enforcing anything else.',
      'ENTIRE AGREEMENT. These terms, with the community guidelines and privacy policy, are the whole agreement between you and us, and replace anything said before.',
      'ASSIGNMENT. You may not transfer your rights under these terms. We may transfer ours to a successor or acquirer.',
      'CHANGES. We may update these terms. If a change is material we will tell you and give you the chance to decline by closing your account. Continuing to use HelloNeighbor after a change means accepting it, and the version stamp on your record is the version you accepted at that time.',
      'HEADINGS AND SUMMARIES. The plain-language line under each heading is there to be helpful and is part of these terms. Where it and the numbered paragraphs disagree, the paragraphs govern.',
    ],
  },
];

/**
 * The lines a customer ticks before booking.
 *
 * Short, specific, and each one ticked separately rather than a single "I
 * agree". A tick against a sentence someone read is worth something; a tick
 * against a link they did not open is worth nothing.
 */
export const CUSTOMER_WAIVER = [
  'I understand HelloNeighbor is a listing tool — it is not the employer or supervisor of the person I am booking, and it runs NO background checks on anyone.',
  'I accept the risk of arranging for someone to come to my property to do this work, and I release HelloNeighbor from claims for any injury, loss, theft, or damage arising from it.',
  'I understand HelloNeighbor provides no insurance of any kind, and that any damage or injury is between me and the other person.',
  'I will keep every message about this booking inside the app, and I understand a dispute about anything arranged elsewhere cannot be reviewed.',
  'I understand HelloNeighbor decides only how the money for this booking is settled — and that I keep every other right I have, including going to the police or to court.',
];

/**
 * The lines a provider ticks at signup.
 *
 * Deliberately different from the customer's. A provider is often a minor, so
 * this is written as an acknowledgement of how things work rather than as a
 * release of claims they cannot legally give up anyway.
 */
export const PROVIDER_WAIVER = [
  'I understand HelloNeighbor is not my employer. I work for myself, I set my own prices and hours, nobody here supervises my work, and I get no wage, benefits, or workers’ compensation.',
  'I understand HelloNeighbor runs NO background check on the people who book me, and that deciding whether a job is safe to take is mine and my guardian’s to make.',
  'I understand HelloNeighbor provides no insurance covering me, my work, or anything I might damage.',
  'I am responsible for my own taxes on what I earn.',
  'I will keep every message with a customer inside the app, and I understand a dispute about anything arranged elsewhere cannot be reviewed.',
  'I understand I can cancel or leave any booking at any time, for any reason or none, and nobody here will hold it against me.',
  'I understand HelloNeighbor decides only how the money for a booking is settled, and that I keep every other right I have.',
];

/** What actually happens after a dispute is opened. Shown next to the form. */
export const DISPUTE_STEPS = [
  'Say what happened, say what you want, and attach whatever proof you have. Your messages are already on the record.',
  'The other person is told and gets to give their side and attach their own proof.',
  'An administrator reads the booking, the messages, and both sides’ evidence.',
  'We decide how the money for this booking is settled, and tell you both.',
  'If someone behaved badly, we act on their account — a warning, a suspension, or a closure — and tell you which.',
  'Whatever we decide, you keep every right you have to take it further yourself.',
];
