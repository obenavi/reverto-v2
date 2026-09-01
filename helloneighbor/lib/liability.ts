/**
 * The agreements users accept, and the consents they tick.
 *
 * ## Structure
 *
 * Five separate agreements plus jurisdictional addenda, rather than one
 * document everybody signs. Counsel's review was explicit about this: a
 * customer, a provider, a guardian and a community organisation are agreeing
 * to different things, and merging them produces a document where nobody's
 * obligations are clear and half the clauses do not apply to the reader.
 *
 * ## What changed after legal review, and why
 *
 * Each of these was in the previous draft and was wrong. They are listed here
 * because the reasons are not obvious from the replacement text, and somebody
 * will otherwise "simplify" them back.
 *
 *   "We are not a money transmitter."  Deleted as an absolute. Whether a
 *     payment feature is regulated depends on how it operates, and stating the
 *     conclusion does not make it true. Now conditional.
 *
 *   "Everything that follows is your responsibility."  Deleted. Sweeping
 *     responsibility-shifting clauses are the kind courts strike, and striking
 *     one can take neighbouring clauses with it.
 *
 *   "Messages are retained indefinitely."  Deleted. Indefinite retention with
 *     no documented necessity is a privacy problem, not a safety feature.
 *     Replaced with stated periods.
 *
 *   "Providers work for themselves."  Kept, but qualified. Contract language
 *     cannot decide worker classification — the statutory test and the
 *     parties' actual conduct do (Cal. Lab. Code s 2775). Saying it flatly
 *     invites the argument that we thought a sentence settled it.
 *
 *   "An off-app dispute will be closed without a finding."  Narrowed. Telling
 *     users evidence will be ignored is both bad practice and unenforceable
 *     against a safety report. Off-platform conduct now limits what we can
 *     investigate; it does not bar anything.
 *
 *   Universal enforceability.  Removed throughout. No waiver, cap, arbitration
 *     clause or governing-law provision is enforceable everywhere, and a
 *     document that claims otherwise reads as overreaching in exactly the
 *     places it most needs to survive.
 *
 * ## The limits that stay stated out loud
 *
 * A guardian cannot waive a minor's own claims, and a minor may disaffirm
 * certain contracts (Cal. Fam. Code s 6710). Gross negligence, recklessness
 * and intentional misconduct cannot be released. California scrutinises
 * releases affecting negligence claims for clarity, scope and public policy
 * (Tunkl v. Regents, 60 Cal. 2d 92 (1963)). Writing around these makes the
 * document weaker, not stronger.
 *
 * NOT LEGAL ADVICE. A serious draft following a written review, not a reviewed
 * instrument. Jurisdiction-specific counsel is required before launch, and the
 * launch-gating checklist in docs/ lists what has to happen first.
 */

/** Bump on any material change. Stored against every acceptance. */
export const LIABILITY_VERSION = '2026-09-01.1';

/** The one state with a written addendum so far. Others gate on review. */
export const LAUNCH_JURISDICTION = 'California';

export type Clause = {
  n: number;
  title: string;
  /**
   * One sentence in plain language, rendered above the clause.
   *
   * Conspicuousness is part of enforceability — a term a court finds buried
   * binds nobody — and it is the honest thing to give a fourteen-year-old and
   * their mother. Clause 1 of the general terms says the operative paragraphs
   * govern where the two differ.
   */
  plain: string;
  body: string[];
};

export type AgreementDoc = {
  id: string;
  title: string;
  /** Who signs it. */
  audience: string;
  /** Shown at the top, before clause 1. */
  preamble: string;
  clauses: Clause[];
};

/** Everyone accepts this, whatever else they sign. */
export const GENERAL_TERMS: AgreementDoc = {
  id: 'general',
  title: 'General Terms',
  audience: 'Everyone who uses HelloNeighbor',
  preamble:
    'These terms apply to everyone. Depending on what you do here you will also accept a Customer, Provider, Guardian or Community Organization Agreement, and an addendum for the state you are in.',
  clauses: [
    {
      n: 1,
      title: 'Who these terms are between, and how to read them',
      plain: 'This is between you and HelloNeighbor. It is not the agreement between you and the person you book.',
      body: [
        '“HelloNeighbor”, “we” and “us” mean the company operating this app, its owners, officers, employees and contractors. “You” means anyone who uses HelloNeighbor in any way. “Provider” means someone listing services. “Customer” means someone booking one. “Guardian” means a parent, legal guardian, or approved older sibling on a young person’s account. “Community organization” includes any school, nonprofit, neighborhood association, sponsor, or person running a neighborhood group here.',
        'The agreement for any actual work is between the customer and the provider. We are not a party to it and are not bound by it.',
        'Each clause opens with a plain-language line. It is part of these terms and is there to be read. Where it and the numbered paragraphs differ, the numbered paragraphs govern.',
        'You will also accept a separate agreement for your role, and a state addendum. Where a role agreement or an addendum conflicts with these General Terms, the more specific document governs for that person in that place.',
      ],
    },
    {
      n: 2,
      title: 'Local law comes first',
      plain: 'Where your local law gives you a right we cannot take away, it wins over anything in here.',
      body: [
        'Nothing in any HelloNeighbor agreement waives, limits, or displaces a right or protection that the law of your jurisdiction does not permit to be waived, limited, or displaced.',
        'We do not claim that any release, arbitration clause, class waiver, limitation of liability, or choice of law in these documents is enforceable everywhere. Enforceability varies by state and by country, and several of these provisions are limited or unavailable in some places.',
        'Where a provision is limited by local law, it applies as far as that law permits and no further, and the rest of the agreement stays in force. Where a provision is unavailable entirely, it is severed and the rest stays in force.',
        'Certain services and features are available only in certain places, and may be restricted by your location, the location of the work, the ages of the people involved, the service category, the time of day, the payment method, licensing requirements, or local privacy and employment rules.',
      ],
    },
    {
      n: 3,
      title: 'What HelloNeighbor is',
      plain: 'A noticeboard with a calendar. We do not employ, supervise, direct, or attend anyone’s work.',
      body: [
        'HelloNeighbor lists people offering small neighborhood services, lets you book a time, and keeps a record of what was said in the app.',
        'We are not an employer, employment agency, staffing service, contractor, subcontractor, broker, supervisor, or guarantor. We do not assign work, set prices, direct how a job is done, inspect any property, provide tools or transport, or attend any booking.',
        'Providers offer services on their own account. Contractual classification does not determine legal classification: applicable statutory tests and the parties’ actual conduct control. Nothing in these terms is a representation that any particular classification applies to any particular person under any particular law.',
        'We do not monitor bookings in real time. Nobody is watching a job happen. In-app messages are recorded so they can be read later; they are not read as they are sent.',
      ],
    },
    {
      n: 4,
      title: 'What we check, and what we do not',
      plain: 'We do a few narrow checks. We run no criminal background checks on anyone.',
      body: [
        'We use precise words for these on purpose, and you should read them precisely. What we do: a person reviews a listing for prohibited content before it goes live; a provider’s age is stated by the user and, where a check is offered, an age estimate or document check may be recorded; guardian consent is recorded for accounts that require it; an adult check is recorded for parent and group-owner accounts.',
        'We do not run criminal background checks, sex-offender registry checks, or any other criminal history check, on providers or on customers. Not at signup, not ever, unless and until we say otherwise in writing and describe what the check covers.',
        'We do not verify identity beyond the checks named above. We do not confirm names, addresses, employment, references, driving records, or immigration status. We do not confirm that anyone holds insurance, a licence, a certification, or a permit. We do not inspect any home, yard, tool, ladder, chemical, vehicle, or animal.',
        'A listing being live means it was reviewed for prohibited content and did not obviously break our rules. It is not a statement that a person is safe, trusted, approved, vetted, certified, or insured, and we do not describe anyone here in those words.',
        'Automated screening is not perfect and is not represented as perfect. Moderation is discretionary and limited, and is not a guarantee that prohibited conduct will be detected or prevented.',
        'You are the one deciding whether a particular booking is right for you. Nothing here replaces your own judgement, and nothing here is a reason to skip it.',
      ],
    },
    {
      n: 5,
      title: 'Who may use HelloNeighbor',
      plain: 'Providers 14+ with an adult on the account under 18. Customers and guardians 18+. Group owners 21+.',
      body: [
        'You may offer services if you are 14 or over, subject to the age, permit, and occupational rules of your state — which may be stricter, and which control where they are.',
        'A provider under 18 must have a verified guardian on the account before it goes live, and their guardian may remove it at any time.',
        'You must be 18 or over to book a service or hold a guardian account, and 21 or over to run a neighborhood group.',
        'One account per person. Do not create an account for anyone else, share your login, let anyone else use your account, or make a new account after we have closed one of yours. Activity through your account is treated as yours.',
        'Tell us promptly if you think someone else has got into your account.',
      ],
    },
    {
      n: 6,
      title: 'Services that are not available here',
      plain: 'A list of things nobody may offer or request, whatever both sides agree.',
      body: [
        'The following are blocked and may not be offered, requested, or performed through HelloNeighbor: babysitting, childcare, eldercare, personal care, and medical or nursing services; transportation of passengers and driving-related services; electrical, plumbing, gas, roofing, structural, or other regulated work; tree removal, roof work, or work on a ladder above standing height; anything involving firearms, weapons, or dangerous equipment; chemicals beyond ordinary household cleaning products; pest control; handling animals that present a material risk; pool access or water-related work; overnight work; entry into a residence when no responsible adult is present; and anything involving alcohol, tobacco, vaping products, cannabis, or illegal drugs.',
        'Any service requiring a licence, certification, permit, or insurance is unavailable unless we have separately approved it in writing for that place and that person.',
        'Attempting to convert a booking into any of the above after it starts is a breach of these terms by whoever asks, and any provider may refuse and leave.',
      ],
    },
    {
      n: 7,
      title: 'You accept the risk',
      plain: 'Strangers coming to your home, or you going to a stranger’s home, carries real risk.',
      body: [
        'Small jobs at private homes carry real risk. Someone can be injured. Property can be damaged, lost, or stolen. A person can turn out to be dishonest, unreliable, intoxicated, aggressive, or dangerous. There may be animals, unsafe steps, chemicals, tools, weather, vehicles, or other people present.',
        'You voluntarily assume the risks of using HelloNeighbor, including risks arising from other people at or near the address.',
        'This clause does not apply to a minor’s own claims, which a guardian cannot assume or waive on their behalf. See the Guardian Agreement.',
      ],
    },
    {
      n: 8,
      title: 'Release of claims against us',
      plain: 'You give up claims against us for what happens on a booking — except the ones the law does not allow anyone to give up.',
      body: [
        'To the fullest extent permitted by applicable law, you release HelloNeighbor from claims arising out of or connected with a listing, a booking, a service performed or not performed, a payment, a cancellation, a message, a review, or any interaction between users of this app.',
        'This release does not cover gross negligence, recklessness, wilful misconduct, or fraud, and does not apply to any claim that applicable law does not permit to be released. Where a state limits releases of negligence claims, this release applies only as far as that state permits.',
        'This release does not release the claims of any minor. A guardian’s acceptance binds the guardian’s own claims and does not waive the young person’s. See the Guardian Agreement and the California Addendum.',
        'To the extent permitted, you also waive any statute limiting a general release to claims known at signing, including California Civil Code section 1542 and equivalents elsewhere. This waiver does not extend to claims that cannot lawfully be released.',
      ],
    },
    {
      n: 9,
      title: 'The service is provided as it is',
      plain: 'No promises about the app working, or about anyone on it being any good.',
      body: [
        'HelloNeighbor is provided “as is” and “as available”. To the fullest extent permitted by applicable law we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, title, non-infringement, and accuracy.',
        'We do not warrant that the app will be available, uninterrupted, secure, or error-free; that any listing, price, review, photograph, or piece of information is true or complete; or that any provider or customer is safe, honest, competent, insured, or suitable for you.',
        'Some jurisdictions do not permit certain warranties to be disclaimed. Where that is so, this clause applies as far as permitted and no further.',
      ],
    },
    {
      n: 10,
      title: 'Emergencies, and what we do not undertake to do',
      plain: 'We are not an emergency service, we do not monitor jobs, and we have no duty to rescue anyone.',
      body: [
        'HELLONEIGHBOR IS NOT AN EMERGENCY SERVICE AND DOES NOT MONITOR JOBS IN REAL TIME. CALL EMERGENCY SERVICES FIRST WHEN ANYONE IS IN IMMEDIATE DANGER.',
        'We do not undertake to supervise any work, to intervene in any situation, to rescue anyone, to investigate any incident, or to guarantee anyone’s safety. Reporting something to us is not a substitute for contacting emergency services, and we may not see a report for some time.',
        'We provide reporting tools and may suspend accounts, preserve records, and contact law enforcement. Doing any of those things in one case does not create a duty to do them in another, and is not an admission that we were responsible for anything.',
        'Any user may cancel or leave any booking at any time, for any reason or none, without penalty, and we will not treat leaving a situation that felt wrong as a mark against anyone.',
      ],
    },
    {
      n: 11,
      title: 'Keeping communication in the app',
      plain: 'Message here so there is a record. Going elsewhere limits what we can look into — it does not bar anything.',
      body: [
        'Keep messages about a booking in the app. In-app messages are timestamped and retained, which is what makes it possible to work out later what was actually agreed.',
        'If a conversation happened somewhere we cannot see, our ability to investigate a dispute about it is limited, and we may be unable to reach a conclusion. That is a practical limit, not a rule that your evidence will be ignored: we will consider safety-related evidence wherever it comes from, and we preserve relevant records.',
        'Do not share your home address, school, workplace, or full schedule beyond what a specific booking requires. We may detect and discourage attempts to exchange contact details.',
        'Nothing in these terms prevents you from contacting emergency services, law enforcement, a regulator, a lawyer, or an insurer about anything, at any time.',
      ],
    },
    {
      n: 12,
      title: 'Things you must not do',
      plain: 'The conduct that gets an account closed.',
      body: [
        'Do not offer or request anything in clause 6. Do not misrepresent your age, identity, or what you are offering, or use someone else’s photograph.',
        'Do not harass, threaten, stalk, intimidate, defame, or discriminate against anyone. Do not send sexual content, and never anything sexual to or about a minor.',
        'Do not use HelloNeighbor to recruit for another platform, to advertise, to scrape data, to send spam, to test security, to bypass any limit or check, or to build a competing service.',
        'Do not arrange payment outside what the booking records in order to avoid our records or anyone’s taxes.',
        'Do not post a review that is dishonest, that you were paid to write, or that reveals someone’s address or personal details.',
      ],
    },
    {
      n: 13,
      title: 'What we do about people who cause harm',
      plain: 'Ordinary problems escalate. Serious ones mean immediate suspension.',
      body: [
        'Ordinary problems escalate: a warning on the record, then a suspension, then closure. Serious matters — violence, threats, sexual conduct, weapons or drugs, or anything putting a young person at risk — mean immediate suspension while a person reviews it, with no warning stage.',
        'Closure removes the listing, ends the ability to book or be booked, and blocks the same phone number and email from signing up again.',
        'You may appeal any action by writing to us, and a person will look again.',
        'We will tell you what action was taken on a report you made. We will not tell you anything else about the other person’s account.',
        'We may suspend or close any account at any time where we believe it is necessary to protect someone. Enforcement is discretionary and we do not guarantee that we will detect or act on any particular conduct.',
      ],
    },
    {
      n: 14,
      title: 'Disputes between users',
      plain: 'File in the app with proof. We decide what happens to accounts, never who owes whom.',
      body: [
        'Try to settle it in the app first. If that does not work, open a dispute on the booking, say what happened and what you want, and attach your evidence. The other person is told and may respond with their own before anything is decided.',
        'A person reviews the booking, the messages, and both sides’ evidence, and decides one thing: what happens to the accounts involved — nothing, a warning, a suspension, or closure. That is the entire scope of what we decide.',
        'We cannot decide money, and we are not refusing to: we never hold any. You pay the other person directly, so there is no payment for us to release, capture, refund or withhold, and a finding from us moves nothing. Anything owed between you is owed between you.',
        'We do not decide fault for an injury, value damaged property, or award damages. We are not a court, an arbitrator between users, or an insurer.',
        'Our finding has no effect on any right you have against the other person. You may go to the police, to court, to your insurer, or to a lawyer, with or without it. On written request we will give you your own booking record and the messages from that booking, which is usually what a small claims court wants to see.',
      ],
    },
    {
      n: 15,
      title: 'Money',
      plain: 'You pay each other directly. The only money we ever take is a provider’s subscription.',
      body: [
        'HelloNeighbor does not process payments between users. There is no card button, no wallet, no balance, no escrow and no payout. Every payment for a job is made directly from the neighbour to the provider — cash, or an app such as Venmo, Cash App, Zelle or PayPal that the two of you already use. We record which method was agreed and the amount, and that is the whole of our involvement.',
        'Because we hold nothing, we cannot take a payment, release one, refund one, reverse one, or hold one back while a dispute runs. If someone does not pay, the debt is owed to the other person and is theirs to pursue, in small claims court if it comes to that.',
        'The price shown at booking is the price. Renegotiating off the app is a breach of these terms.',
        'The only money HelloNeighbor takes from anyone is the subscription a provider pays for access to the listing and scheduling tools. It is a fee for software. It is not a commission on anyone’s work, not a booking fee, not a placement fee, not a payment for finding anyone work, and it does not purchase insurance or make us a party to any job. Fees already paid are not refundable except where we say so in writing or where the law requires it.',
        'If we ever add a feature that moves money between users, we will say so plainly before it goes live, and we will use a licensed third-party processor and keep user funds separate from our own. Nothing in this clause is a promise that any such feature is unregulated — whether it is depends on how it operates and on the law that applies to it.',
      ],
    },
    {
      n: 16,
      title: 'There is no insurance here',
      plain: 'We do not insure anyone. There is no protection fund. Arrange your own cover.',
      body: [
        'HelloNeighbor does not currently provide, arrange, broker, or pay for any insurance covering any user, job, property, or injury. There is no guarantee fund, host protection programme, or damage reimbursement.',
        'If that changes we will say so, describe what the cover actually is, and not before.',
        'Arrange your own cover if you want it. Homeowners and renters policies sometimes cover damage caused by someone working at your home and sometimes exclude it — find out which yours does. A provider should not assume a household policy covers paid work.',
      ],
    },
    {
      n: 17,
      title: 'Messages we send you',
      plain: 'Service messages are part of the app. Marketing is a separate tick you can withdraw.',
      body: [
        'Service messages — about your account, your bookings, safety matters, disputes, and payments — are part of how HelloNeighbor works, and we send them by text and push notification to the details you give us.',
        'Marketing messages are separate and require their own consent, which you give and withdraw independently. We will not make your use of HelloNeighbor conditional on agreeing to marketing, and withdrawing marketing consent changes nothing else about your account.',
        'Reply STOP to any marketing message to stop it. We may still send service, safety, and dispute messages, and messages to a guardian about a young person’s account.',
        'Message and data rates may apply and message frequency varies. We record which consent you gave, its wording and version, when, how, and its current state.',
      ],
    },
    {
      n: 18,
      title: 'Your information',
      plain: 'We keep what we need for as long as we say, and no longer.',
      body: [
        'What we collect and why is set out in the Privacy Policy, with separate notices for California residents and for young people and their guardians.',
        'In-app messages relating to a booking are retained for two years from the booking, and longer only where a dispute, report, safety matter, or legal obligation requires it — in which case they are retained until that is resolved and then deleted on the ordinary schedule.',
        'Identity and age checks store the outcome only. No face image, document scan, or biometric template is stored at any point.',
        'You may request access to your information or its deletion. Some records are retained after an account closes where a dispute, safety matter, or law requires it, and the Privacy Policy says which and for how long.',
        'Guardian access to a young person’s booking information is logged.',
      ],
    },
    {
      n: 19,
      title: 'What you post',
      plain: 'You keep your photos and reviews. You let us show them.',
      body: [
        'You keep ownership of what you post. You grant us a non-exclusive, royalty-free licence to host, store, reproduce and display it for the purpose of operating HelloNeighbor. The licence ends when you delete the content, except for copies retained in backups, dispute records, or where the law requires.',
        'You confirm you have the right to post it and that it does not show a person who has not agreed to appear.',
        'Reviews must be honest and about your own experience. We may remove content that is untrue, abusive, reveals personal details, or breaks these terms. We are not obliged to remove anything, and removing one thing does not oblige us to review everything.',
      ],
    },
    {
      n: 20,
      title: 'Tax',
      plain: 'What you earn here may be taxable. That is between you and the tax authorities.',
      body: [
        'Money earned through HelloNeighbor may be taxable income, and providers are responsible for their own tax obligations. We do not withhold tax and do not provide tax advice.',
        'We do not provide workers’ compensation, unemployment cover, health cover, sick pay, holiday pay, or any employment benefit.',
        'Our records are a record of what the app was told. They do not determine the legal classification or tax treatment of any transaction, and should not be relied on as if they did.',
      ],
    },
    {
      n: 21,
      title: 'The most we could owe you',
      plain: 'Capped at what you have paid us, or one hundred dollars — except where the law says otherwise.',
      body: [
        'To the fullest extent permitted by applicable law, our total liability to you for all claims in aggregate is limited to the greater of the fees you paid HelloNeighbor in the twelve months before the event, or one hundred United States dollars.',
        'We are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, income, opportunity, data, or reputation.',
        'This cap does not apply to any claim that applicable law does not permit to be limited, including claims for gross negligence, recklessness, wilful misconduct or fraud where a state does not permit their limitation, and does not apply to a minor’s nonwaivable claims.',
        'Where a jurisdiction does not permit some of these limits, this clause applies as far as permitted and no further, and the rest stands.',
      ],
    },
    {
      n: 22,
      title: 'Disagreements with us',
      plain: 'Individual arbitration, no class actions, small claims still available, and you can opt out in 30 days.',
      body: [
        'You and HelloNeighbor agree that a dispute between you and us will be resolved by binding individual arbitration rather than in court, to the extent applicable law permits.',
        'YOU AND WE EACH WAIVE THE RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS ACTION, CLASS ARBITRATION, OR REPRESENTATIVE PROCEEDING, to the extent applicable law permits. An arbitrator may award relief only to you individually.',
        'Either of us may bring an individual claim in small claims court instead, if it qualifies. Either may seek an injunction in court to protect intellectual property.',
        'You may opt out of arbitration entirely by writing to us within 30 days of first accepting these terms. Opting out changes nothing else about your account and we will not treat you differently for it.',
        'This clause does not apply where applicable law does not permit it, does not apply to any claim that cannot lawfully be sent to arbitration, does not apply to a minor’s nonwaivable claims, and does not restrict anyone from reporting to or cooperating with a government agency.',
        'This clause concerns claims against us. It has no effect on any claim you have against another user.',
        'Before starting arbitration, write to us describing the dispute and give us 30 days to try to resolve it.',
      ],
    },
    {
      n: 23,
      title: 'Ending your account',
      plain: 'Leave whenever. We can close an account whenever. Some clauses outlive the account.',
      body: [
        'You may close your account at any time from your settings. We may suspend or terminate access where you have broken these terms or where we believe it protects someone.',
        'When an account ends, bookings already made may be cancelled, and money owed between users remains owed between them.',
        'Clauses 2, 7, 8, 9, 10, 14, 18, 20, 21, 22 and 24, and the indemnity in any role agreement, survive the ending of your account for as long as any claim they concern may be brought.',
      ],
    },
    {
      n: 24,
      title: 'The fine print that decides everything else',
      plain: 'If one clause falls, the rest stand. That is the most important sentence here.',
      body: [
        'SEVERABILITY. If any part of these terms is unenforceable it is limited or severed to the minimum extent necessary and everything else stays in full force. If a release or limitation is unenforceable as to one claim, one person, or one jurisdiction, it remains enforceable as to every other.',
        'STATUTORY RIGHTS PRESERVED. Nothing here limits any nonwaivable statutory right, any right to report to or cooperate with a government agency, or any protection given to minors.',
        'GOVERNING LAW AND VENUE. These terms are governed by the law of the State of [STATE OF ORGANIZATION], without regard to conflict-of-law rules, except where the law of your own jurisdiction gives you nonwaivable rights, which control. Where arbitration does not apply, the state and federal courts located in [COUNTY, STATE] have jurisdiction, except where your own jurisdiction requires otherwise.',
        'NO WAIVER. Not enforcing something is not a waiver of it.',
        'ENTIRE AGREEMENT. These General Terms, your role agreement, any applicable addendum, the community guidelines and the Privacy Policy are the whole agreement between you and us.',
        'ASSIGNMENT. You may not transfer your rights. We may transfer ours to a successor or acquirer.',
        'CHANGES. We may update these terms and will tell you when a change is material, giving you the chance to decline by closing your account. Your record stores the version you accepted and when.',
      ],
    },
  ],
};

export const CUSTOMER_AGREEMENT: AgreementDoc = {
  id: 'customer',
  title: 'Customer Agreement',
  audience: 'Anyone booking a service',
  preamble:
    'Accepted before your first booking, in addition to the General Terms. It is mostly about your home, because that is where the work happens and it is the part only you control.',
  clauses: [
    {
      n: 1,
      title: 'Your premises',
      plain: 'Your house, your responsibility to make it safe for whoever you invited.',
      body: [
        'Before a booking, disclose any hazard you know of: unsafe steps, a broken gate, loose decking, a wasp nest, an unfenced pool, faulty wiring, anything.',
        'Secure animals and anything dangerous. If there is a dog, say so, and put it away unless the provider has agreed otherwise in the app.',
        'Where you are providing tools, materials, or equipment, provide ones that are safe and in working order, and show the provider how they work.',
        'Say who else will be at the property and how the provider gets in and out.',
      ],
    },
    {
      n: 2,
      title: 'When the provider is under 18',
      plain: 'You stay at the property the whole time, and they do not go inside alone.',
      body: [
        'You or another responsible adult must be present at the property for the whole of any booking with a provider under 18.',
        'A provider under 18 may not enter your residence when no responsible adult is present. Work should be outdoors or in a visible part of the property wherever the job allows.',
        'Do not transport a provider anywhere. If a job needs something collecting, agree it in the app and handle it yourself.',
        'Their guardian can see the booking and can cancel it at any time, and the young person can leave at any time without giving a reason.',
      ],
    },
    {
      n: 3,
      title: 'Keeping the job the job',
      plain: 'Do not turn a car wash into something else once they are there.',
      body: [
        'Do not ask a provider to do anything outside the service that was booked, and never anything in clause 6 of the General Terms.',
        'Do not ask a provider to work off the app, to take payment outside what the booking records, or to arrange future work privately.',
        'A provider may refuse and leave, and their doing so is not a breach of anything.',
      ],
    },
    {
      n: 4,
      title: 'Reporting',
      plain: 'Tell us about hazards, injuries, threats, or anything that looked like exploitation.',
      body: [
        'Report promptly any injury, near miss, hazard, threat, or conduct that concerned you, including anything that looked like a young person being exploited.',
        'If anyone is in immediate danger, call emergency services first. We are not an emergency service and do not monitor jobs.',
      ],
    },
    {
      n: 5,
      title: 'You cover us for what you cause',
      plain: 'If someone sues us over your conduct or your property, you pay for that.',
      body: [
        'You agree to defend, indemnify and hold HelloNeighbor harmless from any claim, loss, liability, cost or expense, including reasonable legal fees, to the extent it arises out of your own conduct, your premises, your negligence or misconduct, or your violation of law or of these terms.',
        'This indemnity is limited to what you caused. It does not extend to claims arising from our own gross negligence, recklessness, wilful misconduct or fraud, or to anything not attributable to you.',
        'It survives the ending of your account.',
      ],
    },
  ],
};

export const PROVIDER_AGREEMENT: AgreementDoc = {
  id: 'provider',
  title: 'Provider Agreement',
  audience: 'Anyone offering services',
  preamble:
    'Accepted at signup, in addition to the General Terms. If you are under 18 your guardian signs their own agreement as well.',
  clauses: [
    {
      n: 1,
      title: 'You are running your own thing',
      plain: 'You choose the jobs, the prices and the hours. Nobody here supervises you.',
      body: [
        'You decide which jobs to accept, decline, or cancel, and there is no quota, minimum activity requirement, acceptance rate, or penalty for saying no.',
        'You set or negotiate your own prices, choose your own availability, and control how you do the work.',
        'You may work through any other platform or business at the same time. Nothing here is exclusive.',
        'We do not require uniforms, scripts, routes, or particular tools, and we do not supervise your performance beyond enforcing safety rules and these terms.',
        'We do not describe you as an employee, a team member, or a HelloNeighbor worker, and you should not describe yourself that way to customers.',
        'Contractual classification does not determine legal classification. Applicable statutory tests and the parties’ actual conduct control.',
      ],
    },
    {
      n: 2,
      title: 'No wage, no benefits, your own tax',
      plain: 'You are paid by the customer, not by us. Your taxes are yours.',
      body: [
        'Customers pay you. HelloNeighbor charges you a subscription for access to the listing and scheduling tools; that fee is not a commission on your work and does not make us a party to any job.',
        'We do not pay wages, and do not provide workers’ compensation, unemployment cover, health cover, sick pay, holiday pay, or any employment benefit.',
        'You are responsible for your own tax on what you earn, and for any local licence or registration your work requires.',
      ],
    },
    {
      n: 3,
      title: 'If you are under 18',
      plain: 'Extra rules apply to you, and some of them are the law, not ours.',
      body: [
        'Your account does not go live until a guardian is verified on it, and they can remove it at any time.',
        'Every booking is visible to your guardian, and they can cancel any of them.',
        'You may not work past the curfew that applies to you, and your guardian may set an earlier one.',
        'Child labor laws differ by state and may restrict the hours you may work, the times of day, work during school hours, and the kinds of work you may do — and some states require a work permit before you may work at all. Those laws control over anything in this app, and it is your and your guardian’s responsibility to comply with them. We may block or restrict features to help, but we do not determine what the law requires of you.',
        'Customers are told you are under 18 before they book.',
      ],
    },
    {
      n: 4,
      title: 'Leaving is always allowed',
      plain: 'Any job, any time, any reason or none.',
      body: [
        'You may cancel or leave any booking at any time, for any reason or none, including because something felt wrong. You do not owe anyone an explanation.',
        'Nobody here will hold it against you, and it will not count against your account.',
        'Do not do anything you were not booked for, anything in clause 6 of the General Terms, or anything you are not comfortable with.',
      ],
    },
    {
      n: 5,
      title: 'What you say about yourself',
      plain: 'Your listing has to be true.',
      body: [
        'Describe accurately what you offer, what you charge, and how long it takes. Do not claim a qualification, licence, certification, or insurance you do not have.',
        'Do not use someone else’s photograph or misstate your age.',
        'You may not offer anything in clause 6 of the General Terms, whatever a customer asks for.',
      ],
    },
  ],
};

export const GUARDIAN_AGREEMENT: AgreementDoc = {
  id: 'guardian',
  title: 'Guardian Agreement',
  audience: 'A parent, legal guardian, or approved older sibling on a young person’s account',
  preamble:
    'Accepted before a young person’s account goes live. Read clause 5 in particular: it says what your signature does not do.',
  clauses: [
    {
      n: 1,
      title: 'Who you are',
      plain: 'You are the adult accountable for this account day to day.',
      body: [
        'You confirm you are over 18 — or over 21 if you are their sibling — and that you have the authority to make this decision for this young person.',
        'A parent or legal guardian signs as their guardian. An older sibling signs as the adult running the account day to day, not as a legal guardian, and cannot give the guardianship confirmation a parent gives.',
        'Your identity and your relationship to them are recorded, along with contact details we can reach you on.',
      ],
    },
    {
      n: 2,
      title: 'What you are taking on',
      plain: 'Authorising the account, and supervising what happens through it.',
      body: [
        'You authorise this account and the bookings accepted through it, and you may withdraw that authorisation at any time, which takes the account offline immediately.',
        'You are responsible for supervising their activity here, for their transportation to and from any job, and for deciding whether a particular booking is appropriate for them — the work, the address, the time of day, and who will be there.',
        'You are responsible for compliance with the child labor laws of your state, including hours, times of day, school-hour restrictions, permitted occupations, and any work permit required. We may restrict features to help, and those restrictions do not tell you what the law requires.',
        'You must keep an emergency contact current, and be reachable while they are working.',
      ],
    },
    {
      n: 3,
      title: 'What you can see and do',
      plain: 'Every booking, the money owed, and a cancel button.',
      body: [
        'You can see every booking on the account: the service, the time, the address, and the customer’s name and contact details.',
        'You can cancel any booking immediately, and you can take the account offline entirely.',
        'You can set the latest time they may still be working, and it applies on top of the platform limit.',
        'You cannot post, message, accept work, or act as them. Those are theirs. Your access to their booking information is logged.',
      ],
    },
    {
      n: 4,
      title: 'Their own agreement',
      plain: 'They agree too, in words they can understand.',
      body: [
        'The young person accepts an age-appropriate version of the rules in their own name, separately from your consent. Both are recorded.',
        'They may refuse or leave any booking at any time without giving a reason, including one you approved.',
      ],
    },
    {
      n: 5,
      title: 'What your signature does not do',
      plain: 'You cannot sign away their right to sue. Nobody can.',
      body: [
        'Your acceptance binds your own claims. It does not release, waive, or limit any claim belonging to the young person.',
        'In many states a parent or guardian cannot waive a minor’s own claims in advance, and a minor may disaffirm certain contracts before reaching majority or within a reasonable time afterwards. In California, see Family Code section 6710.',
        'We are telling you this rather than letting you assume otherwise. Nothing in any HelloNeighbor document should be read as your having signed away their rights, and any provision that purported to do so would be unenforceable as to them.',
      ],
    },
  ],
};

export const COMMUNITY_AGREEMENT: AgreementDoc = {
  id: 'community',
  title: 'Community Organization Agreement',
  audience:
    'Anyone running a neighborhood group, and any school, nonprofit, association or sponsor organising activity here',
  preamble:
    'Accepted before you can run a group. Running one means deciding who is admitted and seeing what is happening on your street, which is real responsibility over other people’s children.',
  clauses: [
    {
      n: 1,
      title: 'We are not behind you',
      plain: 'You are not our employee, partner, agent, sponsor, or franchisee, and we do not insure or supervise you.',
      body: [
        'HelloNeighbor is not your employer, partner, joint venturer, agent, sponsor, insurer, or supervisor, and you are not ours.',
        'You may not describe yourself as acting for HelloNeighbor, use our name to endorse anything, or represent that we have approved, vetted, or insured any person or activity.',
        'Nothing you organise is an activity of HelloNeighbor, whether or not it was arranged through this app.',
      ],
    },
    {
      n: 2,
      title: 'What you are responsible for',
      plain: 'Your people, your premises, your events, your compliance.',
      body: [
        'You are responsible for your own personnel and volunteers; for any premises you use or control; for supervision of any activity you organise or promote; for any screening you choose to carry out; for your own insurance; for your compliance with applicable law; for your communications; and for any transportation you arrange.',
        'If you organise anything beyond the app — a working day, a fundraiser, a meeting — that is yours entirely, and none of it becomes ours because the people involved met here.',
      ],
    },
    {
      n: 3,
      title: 'Running a group here',
      plain: 'You admit and remove people, and you see the bookings inside your group.',
      body: [
        'You must be 21 or over and have passed the adult check.',
        'You decide who is admitted and who is removed. You see the bookings that happened inside your group, by first name, and you do not see members’ contact details, their bookings outside the group, or anything about their accounts.',
        'Admission is limited to people whose stated postal code matches the group’s. A postal code is a filter on who may ask, and is not a verification of anyone.',
        'You must review the group at least weekly. If you do not, the group stops admitting people automatically and requests wait for you.',
        'You may nominate another adult member to take over. If your account is suspended or closed, or you leave, the group passes to them; if you named nobody, it closes.',
      ],
    },
    {
      n: 4,
      title: 'You cover us for what you do',
      plain: 'If someone sues us over your activity, you pay for that.',
      body: [
        'You agree to defend, indemnify and hold HelloNeighbor harmless from any claim, loss, liability, cost or expense, including reasonable legal fees, to the extent it arises out of your activities, your personnel, your premises, your supervision or failure to supervise, your screening, your communications, or your violation of law or of these terms.',
        'This indemnity does not extend to claims arising from our own gross negligence, recklessness, wilful misconduct or fraud.',
        'It survives the ending of your account and the closing of your group.',
      ],
    },
  ],
};

/**
 * Jurisdictional addenda.
 *
 * One per state before that state is enabled, and one per country before it is
 * activated. California is written because it is the intended first launch;
 * every other jurisdiction gates on its own review rather than inheriting this
 * one. A service being permitted in California says nothing about anywhere
 * else, and the compliance matrix in docs/ is what decides.
 */
export const CALIFORNIA_ADDENDUM: AgreementDoc = {
  id: 'addendum-ca',
  title: 'California Addendum',
  audience: 'Users in California',
  preamble:
    'Applies in addition to the General Terms and your role agreement, and governs over them where they differ, for people in California.',
  clauses: [
    {
      n: 1,
      title: 'Worker classification',
      plain: 'A contract cannot decide whether someone is an employee. Conduct and statute do.',
      body: [
        'Nothing in any HelloNeighbor agreement determines whether any person is an employee or an independent contractor under California law. Labor Code section 2775 and the tests it applies control, and they look at what actually happens rather than at what a document says.',
        'HelloNeighbor does not set prices, assign work, require acceptance of work, penalise refusal, require exclusivity, supply tools, or supervise performance beyond safety and policy enforcement. If our conduct ever departs from that, the departure — not this clause — is what matters.',
      ],
    },
    {
      n: 2,
      title: 'Minors',
      plain: 'A guardian cannot waive a minor’s claims here, and a minor may disaffirm.',
      body: [
        'A guardian’s acceptance does not waive or release any claim of the minor. Any provision purporting to do so is unenforceable as to the minor.',
        'A minor may disaffirm certain contracts before reaching majority or within a reasonable time afterwards. See California Family Code section 6710.',
        'California child labor law, including work permit requirements, permitted occupations, and restrictions on hours and school-hour work, applies to any provider under 18 and controls over anything in this app.',
      ],
    },
    {
      n: 3,
      title: 'Releases',
      plain: 'California courts read releases narrowly. Ours is limited accordingly.',
      body: [
        'California scrutinises releases affecting negligence claims for clarity, scope, and public policy. See Tunkl v. Regents of the University of California, 60 Cal. 2d 92 (1963).',
        'The release in clause 8 of the General Terms does not extend to gross negligence, recklessness, wilful misconduct, fraud, or any claim California does not permit to be released, and does not apply to a minor’s own claims.',
        'The waiver of Civil Code section 1542 applies only to claims that may lawfully be released.',
      ],
    },
    {
      n: 4,
      title: 'Privacy',
      plain: 'California residents have specific rights, set out in the California notice.',
      body: [
        'California residents have rights of access, deletion, correction, and control over the sale or sharing of personal information under Civil Code section 1798.100 and following. How to exercise them is in the California Privacy Notice.',
        'We do not sell or share personal information of anyone we know to be under 16.',
        'Age estimation records the outcome only; no face image or biometric template is retained at any point.',
      ],
    },
  ],
};

export const ALL_AGREEMENTS: AgreementDoc[] = [
  GENERAL_TERMS,
  CUSTOMER_AGREEMENT,
  PROVIDER_AGREEMENT,
  GUARDIAN_AGREEMENT,
  COMMUNITY_AGREEMENT,
  CALIFORNIA_ADDENDUM,
];

/**
 * The individual consents, each ticked separately and recorded on its own.
 *
 * Counsel was specific that assumption of risk, release, arbitration, class
 * waiver, SMS, guardian authorisation, minor assent, community responsibility
 * and payment terms are separate acceptances rather than one "I agree". The
 * reason is the same one that put a plain-language line above every clause: a
 * tick against a sentence somebody read is worth something, and a tick against
 * a link they did not open is worth very little.
 *
 * `id` is stable and is what gets stored. Changing an id orphans every
 * previous acceptance, so add a new one instead.
 *
 * `required` false means the account works without it. Only marketing is
 * optional, and it must stay that way — use of HelloNeighbor may never be
 * conditional on agreeing to marketing.
 */
export type Consent = {
  id: string;
  audience: 'customer' | 'provider' | 'guardian' | 'community' | 'minor';
  text: string;
  required: boolean;
  /** Which clause it corresponds to, for anyone auditing the record. */
  refers: string;
};

export const CONSENTS: Consent[] = [
  // ---------------------------------------------------------------- customer
  {
    id: 'customer.risk.v1',
    audience: 'customer',
    required: true,
    refers: 'General Terms 7',
    text: 'I understand HelloNeighbor runs NO criminal background checks on anyone, does not verify identity beyond a few narrow checks, and does not supervise any work. I accept the risks of arranging for someone to come to my property.',
  },
  {
    id: 'customer.release.v1',
    audience: 'customer',
    required: true,
    refers: 'General Terms 8',
    text: 'I release HelloNeighbor from claims arising from this booking, to the extent the law allows — and I understand this does not cover gross negligence, recklessness or intentional misconduct, and cannot release a minor’s own claims.',
  },
  {
    id: 'customer.premises.v1',
    audience: 'customer',
    required: true,
    refers: 'Customer Agreement 1–2',
    text: 'I will disclose hazards, secure animals, and stay at the property for the whole booking whenever the provider is under 18. A provider under 18 will not be alone inside my home.',
  },
  {
    id: 'customer.emergency.v1',
    audience: 'customer',
    required: true,
    refers: 'General Terms 10',
    text: 'I understand HelloNeighbor is not an emergency service, does not monitor jobs, and has no duty to intervene — and that I call emergency services first if anyone is in danger.',
  },
  {
    id: 'customer.arbitration.v1',
    audience: 'customer',
    required: true,
    refers: 'General Terms 22',
    text: 'I agree that claims against HelloNeighbor go to individual arbitration and not a class action, where the law allows — and I understand I can opt out within 30 days, use small claims court, and that this does not affect any claim against the other person.',
  },
  {
    // v2: the platform used to be able to release or refund a card hold, and
    // v1 said so. It cannot any more — it never touches the money — so the
    // sentence somebody ticks had to change with the fact. Old bookings keep
    // the v1 id, because what they agreed to is what they were shown.
    id: 'customer.payment.v2',
    audience: 'customer',
    required: true,
    refers: 'General Terms 14, 15',
    text: 'I understand I pay the provider directly, that HelloNeighbor never holds, moves or refunds that money and cannot settle a money dispute for me, that there is no insurance — and that I keep every other right I have, including going to the police or to court.',
  },
  {
    id: 'customer.sms.service.v1',
    audience: 'customer',
    required: true,
    refers: 'General Terms 17',
    text: 'I agree to receive text messages about my bookings, safety matters and disputes. These are how the app works.',
  },
  {
    id: 'customer.sms.marketing.v1',
    audience: 'customer',
    required: false,
    refers: 'General Terms 17',
    text: 'Optional: send me occasional messages about new features and services near me. I can stop these any time and my account works either way.',
  },

  // ---------------------------------------------------------------- provider
  {
    id: 'provider.independent.v1',
    audience: 'provider',
    required: true,
    refers: 'Provider Agreement 1–2',
    text: 'I understand HelloNeighbor is not my employer. I choose my own jobs, prices and hours, nobody here supervises me, and I get no wage, benefits or workers’ compensation.',
  },
  {
    id: 'provider.risk.v1',
    audience: 'provider',
    required: true,
    refers: 'General Terms 4, 7',
    text: 'I understand HelloNeighbor runs NO criminal background check on the people who book me, and that deciding whether a job is safe to take is mine — and my guardian’s, if I have one.',
  },
  {
    id: 'provider.leaving.v1',
    audience: 'provider',
    required: true,
    refers: 'Provider Agreement 4',
    text: 'I understand I can refuse or leave any booking at any time, for any reason or none, and that nobody here will hold it against me.',
  },
  {
    id: 'provider.prohibited.v1',
    audience: 'provider',
    required: true,
    refers: 'General Terms 6',
    text: 'I will not offer or accept babysitting or any care work, driving, regulated trades, ladder or roof work, or anything else on the prohibited list — whatever a customer asks for or offers to pay.',
  },
  {
    id: 'provider.payment.v1',
    audience: 'provider',
    required: true,
    refers: 'General Terms 15',
    text: 'I collect my own money from the customer, HelloNeighbor never holds it for me, and if someone does not pay, chasing it is mine to do.',
  },
  {
    id: 'provider.tax.v1',
    audience: 'provider',
    required: true,
    refers: 'General Terms 19',
    text: 'I am responsible for my own taxes on what I earn, and for any licence my work needs where I live.',
  },
  {
    id: 'provider.arbitration.v1',
    audience: 'provider',
    required: true,
    refers: 'General Terms 22',
    text: 'I agree that claims against HelloNeighbor go to individual arbitration and not a class action, where the law allows — and I understand I can opt out within 30 days and use small claims court instead.',
  },
  {
    id: 'provider.sms.service.v1',
    audience: 'provider',
    required: true,
    refers: 'General Terms 17',
    text: 'I agree to receive text messages about my bookings, safety matters and payments.',
  },
  {
    id: 'provider.sms.marketing.v1',
    audience: 'provider',
    required: false,
    refers: 'General Terms 17',
    text: 'Optional: send me occasional messages about new features. I can stop these any time and my account works either way.',
  },

  // ------------------------------------------------------------------- minor
  // Their own assent, in their own words, separate from the guardian's consent.
  {
    id: 'minor.assent.v1',
    audience: 'minor',
    required: true,
    refers: 'Guardian Agreement 4',
    text: 'I know my parent or guardian can see every job I take and can cancel any of them, and that I can say no to any job or leave one at any time without explaining why.',
  },
  {
    id: 'minor.safety.v1',
    audience: 'minor',
    required: true,
    refers: 'General Terms 6, 10',
    text: 'I will not go inside a customer’s home when there is no adult there, and I will call emergency services first if anything ever feels dangerous.',
  },

  // ---------------------------------------------------------------- guardian
  {
    id: 'guardian.authority.v1',
    audience: 'guardian',
    required: true,
    refers: 'Guardian Agreement 1',
    text: 'I am over 18 — over 21 if I am their sibling — and I have the authority to make this decision for this young person.',
  },
  {
    id: 'guardian.supervision.v1',
    audience: 'guardian',
    required: true,
    refers: 'Guardian Agreement 2',
    text: 'I take responsibility for supervising their activity here, for getting them to and from jobs, and for deciding whether each booking is appropriate for them.',
  },
  {
    id: 'guardian.childlabor.v1',
    audience: 'guardian',
    required: true,
    refers: 'Guardian Agreement 2',
    text: 'I understand child labor laws in my state may restrict their hours, the times of day, work during school hours, and the kinds of work they may do, and may require a work permit — and that complying with those laws is my responsibility, not the app’s.',
  },
  {
    id: 'guardian.minorclaims.v1',
    audience: 'guardian',
    required: true,
    refers: 'Guardian Agreement 5',
    text: 'I understand my agreement here binds my own claims and does NOT sign away any claim belonging to the young person, because in many states a guardian cannot do that.',
  },
  {
    id: 'guardian.emergency.v1',
    audience: 'guardian',
    required: true,
    refers: 'General Terms 10',
    text: 'I will keep an emergency contact current and be reachable while they are working, and I understand HelloNeighbor does not monitor jobs and is not an emergency service.',
  },

  // --------------------------------------------------------------- community
  {
    id: 'community.notpartner.v1',
    audience: 'community',
    required: true,
    refers: 'Community Agreement 1',
    text: 'I understand HelloNeighbor is not my employer, partner, agent, sponsor, insurer or supervisor, and I will not present my group as approved, vetted or insured by HelloNeighbor.',
  },
  {
    id: 'community.responsibility.v1',
    audience: 'community',
    required: true,
    refers: 'Community Agreement 2',
    text: 'I am responsible for my own people, premises, supervision, screening, insurance, communications and legal compliance, and for anything I organise beyond this app.',
  },
  {
    id: 'community.moderation.v1',
    audience: 'community',
    required: true,
    refers: 'Community Agreement 3',
    text: 'I will review the group at least weekly, I understand a matching zip code verifies nobody, and I will remove anyone who should not be there.',
  },
  {
    id: 'community.indemnity.v1',
    audience: 'community',
    required: true,
    refers: 'Community Agreement 4',
    text: 'I will cover HelloNeighbor for claims arising from my own activities, personnel, premises or supervision.',
  },
];

export function consentsFor(audience: Consent['audience']): Consent[] {
  return CONSENTS.filter((c) => c.audience === audience);
}

export function requiredConsentIds(audience: Consent['audience']): string[] {
  return consentsFor(audience)
    .filter((c) => c.required)
    .map((c) => c.id);
}

/** What actually happens after a dispute is opened. Shown next to the form. */
export const DISPUTE_STEPS = [
  'Say what happened, say what you want, and attach whatever proof you have. Your messages are already on the record.',
  'The other person is told and gets to give their side and attach their own proof.',
  'A person reads the booking, the messages, and both sides’ evidence.',
  'We decide how the money for this booking is settled, and tell you both.',
  'If someone behaved badly, we act on their account — a warning, a suspension, or a closure — and tell you which.',
  'Whatever we decide, you keep every right you have to take it further yourself.',
];
