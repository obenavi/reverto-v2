'use client';

import { useEffect, useState } from 'react';
import { Notice } from '@/components/ui';
import { MAX_HOUSEHOLD_NOTE, MIN_CUSTOMER_BIO, checkBio } from '@/lib/customers';

/**
 * The customer's own profile.
 *
 * Shown on their booking page rather than behind a signup, because making
 * people register to say who they are would mean almost nobody does — and an
 * empty profile is exactly the thing this is meant to fix.
 *
 * The framing matters. This is not "verify yourself"; it is "the person coming
 * to your house is often fifteen, and they are deciding whether to come."
 */
export default function CustomerProfileForm({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [household, setHousehold] = useState('');
  const [hasPets, setHasPets] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Remembered locally so somebody who filled this in once is not asked
    // again on every booking. The server is still the source of truth.
    try {
      setSaved(localStorage.getItem('hn:profile-done') === '1');
    } catch {
      setSaved(false);
    }
  }, []);

  const bioCheck = checkBio(bio);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch('/api/customers/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        display_name: name,
        bio,
        household_note: household,
        has_pets: hasPets,
        photo_url: photoUrl || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not save that.');
      return;
    }
    try {
      localStorage.setItem('hn:profile-done', '1');
    } catch {
      // A blocked storage API is not a reason to fail the save.
    }
    setSaved(true);
    setOpen(false);
  }

  if (saved && !open) {
    return (
      <p className="mt-3 text-[13px] text-ink-faint">
        Your profile is set up.{' '}
        <button className="underline" onClick={() => setOpen(true)}>
          Edit it
        </button>
      </p>
    );
  }

  if (!open) {
    return (
      <section className="card mt-3">
        <p className="font-bold">Tell them who you are</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          The person coming to your house is often fifteen, and they are deciding whether
          to come. A couple of sentences about your household does more for that than
          anything else on this page.
        </p>
        <button className="btn-primary mt-3 w-full" onClick={() => setOpen(true)}>
          Fill in my profile
        </button>
      </section>
    );
  }

  return (
    <form className="card mt-3 space-y-3" onSubmit={save}>
      <p className="font-bold">Your profile</p>

      <div>
        <label htmlFor="cpname">Your name</label>
        <input id="cpname" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="cpbio">About you and your home</label>
        <textarea
          id="cpbio"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="We're a family of four on Maple Street. Fenced back yard, friendly labrador. Usually home while someone's working."
          required
        />
        <p className="mt-1 text-[12px] text-ink-faint">
          {bio.trim().length < MIN_CUSTOMER_BIO
            ? `At least ${MIN_CUSTOMER_BIO} characters — ${Math.max(0, MIN_CUSTOMER_BIO - bio.trim().length)} to go.`
            : bioCheck.ok
              ? 'That works.'
              : bioCheck.error}
        </p>
      </div>

      <div>
        <label htmlFor="cphouse">
          Anything they should expect{' '}
          <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <textarea
          id="cphouse"
          rows={2}
          maxLength={MAX_HOUSEHOLD_NOTE}
          value={household}
          onChange={(e) => setHousehold(e.target.value)}
          placeholder="Steep driveway, side gate is the easiest way in."
        />
        {/* Said out loud, because otherwise it reads as prying. */}
        <p className="mt-1 text-[12px] text-ink-faint">
          This lets someone say no for a reason that is about them — an allergy, a fear of
          dogs — rather than about you.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-[13px]">
        <input
          type="checkbox"
          className="!mt-0.5 !w-auto"
          checked={hasPets}
          onChange={(e) => setHasPets(e.target.checked)}
        />
        <span className="text-ink-muted">There is a pet at the house</span>
      </label>

      <div>
        <label htmlFor="cpphoto">
          Photo URL <span className="font-normal text-ink-faint">(recommended)</span>
        </label>
        <input
          id="cpphoto"
          type="url"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://…"
        />
        <p className="mt-1 text-[12px] text-ink-faint">
          Not required. A face makes a stranger much less of one, but nobody has to put
          theirs on the internet.
        </p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy || !bioCheck.ok}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Later
        </button>
      </div>
    </form>
  );
}
