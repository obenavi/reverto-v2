import Link from 'next/link';
import { TERMS_VERSION } from '@/lib/guidelines';
import { PageHeader, Shell } from '@/components/ui';

export const metadata = {
  title: 'Privacy · HelloNeighbor',
  description: 'What HelloNeighbor collects, why, and how to get it deleted.',
};

const SECTIONS: { title: string; body: (string | string[])[] }[] = [
  {
    title: 'What we collect',
    body: [
      'From people offering services: name, phone number, neighborhood, age, anything written in a bio or listing, and — for anyone under 18 — a parent or guardian’s name, phone number, and optional email.',
      'From neighbors booking a service: name, phone number, the address where the work happens, and any note left for the provider. Neighbors do not create an account.',
      'From everyone: messages sent in the app, and basic technical information every website receives, such as an IP address.',
      'We record the time, name, and IP address attached to each acceptance of the community guidelines, and to each guardian permission.',
    ],
  },
  {
    title: 'Why we collect it',
    body: [
      'To connect the two sides of a booking and let them arrange it.',
      'To send booking notifications and login codes by SMS.',
      'To review content against the community guidelines, which is done automatically using Anthropic’s Claude API. Message text, listings, and signup details are sent to that service for review. Anthropic does not train models on this data.',
      'To resolve a dispute, where an administrator reads the booking record and the messages on it.',
    ],
  },
  {
    title: 'Who sees it',
    body: [
      'The other party to a booking sees your name, your phone number, and the messages you send. A neighbor also gives their address to the provider they booked.',
      'Administrators can see all bookings, all messages, and all accounts.',
      'Our service providers see the parts they need: Supabase (database hosting), Twilio (SMS), Anthropic (content review), and our hosting provider.',
      'We do not sell personal information, and we do not run advertising.',
    ],
  },
  {
    title: 'The face check',
    body: [
      'People offering services may be asked to take a photo so an age-estimation service can check that their stated age is roughly right. Agreeing to it is a separate, explicit step, and you can decline — your application then goes to a person instead.',
      'We do not keep the photo. It is sent to the age-estimation provider, which returns a number, and only that number and the date are stored. We never create or hold a faceprint or any other biometric template, and the photo is not written to our database, our servers, or our logs.',
      'The estimate is a signal, not a decision. It can send an application to a human for review; it cannot approve or reject anyone on its own.',
      'If you would like the estimate removed from your record, email safety@helloneighbor.app.',
    ],
  },
  {
    title: 'Young people',
    body: [
      'People under 18 cannot be approved to offer services until a parent or guardian follows a link we send them and gives permission.',
      'A parent or guardian can withdraw permission, ask what we hold about their child, or ask us to delete it, at any time, by emailing safety@helloneighbor.app. We will act on that within 30 days.',
      'If you believe a child under 13 has signed up without a guardian’s involvement, tell us and we will remove the account.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'Bookings and their messages are kept for two years, because that is the window in which a dispute or a question about a past job realistically arises.',
      'Accounts are kept until deleted. Deleting an account removes the profile, listings, and availability, and detaches the account from past bookings.',
      'Login codes are discarded as soon as they are used or expire, whichever is first.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'Email safety@helloneighbor.app to see what we hold, correct it, or have it deleted.',
      'Reply STOP to any text message to stop SMS from us. Note that this also stops booking notifications, which makes the app close to unusable.',
    ],
  },
  {
    title: 'Security, honestly stated',
    body: [
      'Messages and bookings are stored in a database that the browser cannot read directly; every read and write goes through our server. Links sent to neighbors and guardians carry a signed token, so anyone holding that link can open that one conversation — treat those links as private.',
      'No system is perfectly secure. If we discover a breach affecting your information, we will tell affected users.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <Shell>
      <PageHeader
        title="Privacy"
        subtitle={`Version ${TERMS_VERSION}. Plain language, no lawyer-speak.`}
        back={{ href: '/', label: 'Home' }}
      />

      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <section key={section.title} className="card">
            <h2 className="mb-2 font-bold">{section.title}</h2>
            <div className="space-y-2 text-ink-muted">
              {section.body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-card bg-warning-light p-4 text-[13px] text-warning">
        <p className="font-bold">Before launch</p>
        <p className="mt-1">
          This describes what the software actually does. It has not been reviewed by a
          lawyer, and it does not yet address state-specific requirements or COPPA
          obligations that may apply to users under 13.
        </p>
      </div>

      <p className="mt-6 text-center text-[13px]">
        <Link href="/guidelines" className="font-semibold text-brand">
          Community guidelines →
        </Link>
      </p>
    </Shell>
  );
}
