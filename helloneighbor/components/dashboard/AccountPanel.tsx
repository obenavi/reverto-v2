'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, Notice } from '@/components/ui';
import { formatPhone, formatPrice } from '@/lib/format';
import type { BookingRow, Subscriber } from '@/lib/types';
import { useMutate } from './useMutate';
import AgeCheck from '@/components/AgeCheck';
import LinkParentPanel from './LinkParentPanel';
import AddressPanel from './AddressPanel';

/**
 * Earnings, blocked contacts, and account deletion — the three things an
 * operator could not previously see or do.
 */
export default function AccountPanel({
  operator,
  bookings,
  blocked,
  ageCheckApplies,
}: {
  operator: Subscriber;
  bookings: BookingRow[];
  blocked: string[];
  /** False where this state's provider floor is 18 — see lib/jurisdictions. */
  ageCheckApplies: boolean;
}) {
  const router = useRouter();
  const { mutate, busy, error } = useMutate();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const completed = bookings.filter((b) => b.status === 'completed');
  const earned = completed.reduce((sum, b) => sum + b.price_cents, 0);
  const upcoming = bookings.filter((b) => b.status === 'confirmed');
  const owed = upcoming.reduce((sum, b) => sum + b.price_cents, 0);

  const thisMonth = completed.filter((b) => {
    const date = new Date(b.created_at);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const earnedThisMonth = thisMonth.reduce((sum, b) => sum + b.price_cents, 0);

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);

    const res = await fetch('/api/operators/account?confirm=DELETE', { method: 'DELETE' });
    setDeleting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error ?? 'Could not delete your account.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <AddressPanel
        currentZip={operator.zip_code ?? null}
        currentState={operator.state ?? null}
      />

      <LinkParentPanel
        supervision={operator.supervision ?? 'none'}
        age={operator.age}
        guardianConsentSentAt={operator.guardian_consent_sent_at ?? null}
      />

      {/* Not shown where the age floor is 18. The check exists to catch a
          wrong declared age among minors; with no minors it would be
          collecting a face in exchange for nothing. */}
      {ageCheckApplies && (
        <AgeCheck
          alreadyConsented={Boolean(operator.biometric_consent_at)}
          status={operator.age_verification_status}
          guardianEmailOnFile={operator.guardian_email}
          guardianNameOnFile={operator.guardian_name}
        />
      )}

      <section className="card">
        <p className="font-bold">Earnings</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xl font-extrabold">{formatPrice(earned)}</p>
            <p className="text-[12px] text-ink-muted">all time</p>
          </div>
          <div>
            <p className="text-xl font-extrabold">{formatPrice(earnedThisMonth)}</p>
            <p className="text-[12px] text-ink-muted">this month</p>
          </div>
          <div>
            <p className="text-xl font-extrabold">{formatPrice(owed)}</p>
            <p className="text-[12px] text-ink-muted">still to come</p>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-ink-faint">
          Counted from jobs you marked done. HelloNeighbor never holds your money — cash
          and payment apps go straight to you — so this is a record, not a balance.
        </p>
      </section>

      <section className="card">
        <p className="font-bold">Blocked</p>
        {error && (
          <div className="mt-2">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {blocked.length === 0 ? (
          <p className="mt-1 text-[13px] text-ink-muted">
            Nobody. You can block someone from any conversation.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {blocked.map((phone) => (
              <li key={phone} className="flex items-center justify-between gap-3">
                <span className="font-mono text-[13px]">{formatPhone(phone)}</span>
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    mutate(`/api/blocks?phone=${encodeURIComponent(phone)}`, { method: 'DELETE' })
                  }
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card border-danger">
        <p className="font-bold text-danger">Delete your account</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          Your profile, listings, photos and availability are removed and your name is
          erased. Past bookings stay, showing as a deleted account, because they are also
          the other person&apos;s record. This cannot be undone.
        </p>
        <p className="mt-2 text-[13px] text-ink-muted">
          You cannot delete while a booking is still confirmed or a dispute is open.
        </p>

        <label htmlFor="confirm-delete" className="mt-3">
          Type DELETE to confirm
        </label>
        <input
          id="confirm-delete"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
        />

        {deleteError && (
          <div className="mt-2">
            <Notice tone="error">{deleteError}</Notice>
          </div>
        )}

        <button
          className="btn-danger mt-3 w-full"
          disabled={deleting || confirmText !== 'DELETE'}
          onClick={deleteAccount}
        >
          {deleting ? 'Deleting…' : 'Delete my account permanently'}
        </button>
      </section>

      {operator.status !== 'active' && (
        <EmptyState title={`Your account is ${operator.status}.`} />
      )}
    </div>
  );
}
