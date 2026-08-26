'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmptyState, Notice } from '@/components/ui';
import { formatPhone } from '@/lib/format';
import { CONTACT_RELATIONSHIPS, MAX_EMERGENCY_CONTACTS } from '@/lib/contacts';
import { useMutate } from './useMutate';

type Contact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  priority: number;
  verified_at: string | null;
};

type ChainLink = { who: string; name: string | null };

const WHO_LABEL: Record<string, string> = {
  guardian: 'Your parent or guardian',
  emergency_contact: 'Your emergency contact',
  admin: 'The HelloNeighbor team',
  operator: 'You',
};

/**
 * Who gets called if something goes wrong.
 *
 * Shows the real chain rather than only the entries this person added, so a
 * young person can see a guardian is already in it before deciding whether
 * they need anyone else. An empty chain is the thing worth shouting about.
 */
export default function EmergencyContactsPanel({ isMinor }: { isMinor: boolean }) {
  const { mutate, busy, error } = useMutate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [chain, setChain] = useState<ChainLink[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState<string>(CONTACT_RELATIONSHIPS[0].value);

  const load = useCallback(async () => {
    const res = await fetch('/api/operators/emergency-contacts');
    setLoaded(true);
    if (!res.ok) return;
    const body = await res.json();
    setContacts(body.contacts ?? []);
    setChain(body.chain ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const priority = Math.min(contacts.length + 1, MAX_EMERGENCY_CONTACTS);
    const ok = await mutate('/api/operators/emergency-contacts', {
      method: 'POST',
      body: { name, phone, relationship, priority },
    });
    if (ok) {
      setName('');
      setPhone('');
      setAdding(false);
      load();
    }
  }

  async function remove(id: string) {
    const ok = await mutate(`/api/operators/emergency-contacts?id=${id}`, { method: 'DELETE' });
    if (ok) load();
  }

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      <section className="card">
        <p className="font-bold">If something goes wrong</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          These are the people we text if you press the help button on a job, or if you
          start one and never mark it finished.
        </p>
        {/* Said before anything else, and repeated on the button itself. */}
        <p className="mt-2 text-[13px] font-semibold">
          HelloNeighbor is not an emergency service. If you are in danger, call 911 first —
          we send text messages, we cannot send anyone to you.
        </p>
      </section>

      {error && <Notice tone="error">{error}</Notice>}

      {chain.length === 0 ? (
        <Notice tone="warn">
          Nobody would be contacted right now. Add someone below — it takes a minute and it
          is the whole point.
        </Notice>
      ) : (
        <section className="card">
          <p className="text-[13px] font-semibold">Who we would text, in order</p>
          <ol className="mt-2 space-y-1">
            {chain.map((link, i) => (
              <li key={i} className="text-[13px] text-ink-muted">
                <span className="font-semibold text-ink">{i + 1}.</span>{' '}
                {link.name ?? WHO_LABEL[link.who] ?? link.who}
                <span className="text-ink-faint"> · {WHO_LABEL[link.who] ?? link.who}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-ink-faint">
            Everyone on this list gets the message, not just the first one to answer.
          </p>
        </section>
      )}

      {contacts.length === 0 ? (
        <EmptyState
          title="No emergency contacts yet"
          hint={
            isMinor
              ? 'Your parent is already in the list above. Add one more person — someone else who could come and get you.'
              : 'Add someone who could come and get you.'
          }
        />
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="card flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-[13px] text-ink-muted">
                  {formatPhone(c.phone)} ·{' '}
                  {CONTACT_RELATIONSHIPS.find((r) => r.value === c.relationship)?.label ??
                    c.relationship}
                </p>
                {!c.verified_at && (
                  <p className="mt-1 text-[12px] text-ink-faint">
                    Not confirmed yet — we will still text them, but check the number is
                    right.
                  </p>
                )}
              </div>
              <button
                className="btn-secondary !py-1 text-[13px]"
                disabled={busy}
                onClick={() => remove(c.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {contacts.length < MAX_EMERGENCY_CONTACTS &&
        (adding ? (
          <form className="card space-y-3" onSubmit={add}>
            <p className="font-bold">Add someone</p>
            <div>
              <label htmlFor="ecname">Their name</label>
              <input id="ecname" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="ecphone">Their phone</label>
              <input
                id="ecphone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="ecrel">How you know them</label>
              <select
                id="ecrel"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
              >
                {CONTACT_RELATIONSHIPS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={busy}>
                {busy ? 'Saving…' : 'Add'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="btn-secondary w-full" onClick={() => setAdding(true)}>
            Add an emergency contact
          </button>
        ))}
    </div>
  );
}
