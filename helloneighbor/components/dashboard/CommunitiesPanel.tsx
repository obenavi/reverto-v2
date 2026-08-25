'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmptyState, Notice } from '@/components/ui';
import { MEMBER_ROLES, looksLikeStreetAddress } from '@/lib/communities';
import { useMutate } from './useMutate';

type Owned = {
  id: string;
  name: string;
  area: string;
  invite_code: string;
  invites_open: boolean;
  approval_required: boolean;
  successor_subscriber_id: string | null;
  successor_declined_at: string | null;
  ownership_source: string;
};

type Nomination = {
  id: string;
  name: string;
  area: string;
  successor_declined_at: string | null;
};

type Member = {
  id: string;
  name: string;
  canInherit: boolean;
};

type Membership = {
  communityId: string;
  name: string;
  area: string;
  role: string;
  status: string;
};

/**
 * Neighbourhood groups.
 *
 * The pitch to a young person is not "a feature" — it is that working for
 * people who already know them is safer than working for strangers, and this
 * is how they say "only them". So the switch is the top of the panel, not
 * buried under group management.
 */
export default function CommunitiesPanel({
  communityOnly,
  isAdult,
}: {
  communityOnly: boolean;
  isAdult: boolean;
}) {
  const { mutate, busy, error } = useMutate();
  const [owned, setOwned] = useState<Owned[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [nominatedFor, setNominatedFor] = useState<Nomination[]>([]);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [only, setOnly] = useState(communityOnly);

  const [joinCode, setJoinCode] = useState('');
  const [joinRole, setJoinRole] = useState<string>('both');
  const [joined, setJoined] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/communities');
    if (!res.ok) return;
    const body = await res.json();
    setOwned(body.owned ?? []);
    setMemberships(body.memberships ?? []);
    setNominatedFor(body.nominatedFor ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = memberships.filter((m) => m.status === 'active');

  async function toggleOnly(next: boolean) {
    setOnly(next);
    const ok = await mutate('/api/operators/profile', {
      method: 'PATCH',
      body: { community_only: next },
    });
    if (!ok) setOnly(!next);
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setJoined(null);
    const ok = await mutate('/api/communities/join', {
      method: 'POST',
      body: { code: joinCode, role: joinRole },
    });
    if (ok) {
      setJoinCode('');
      setJoined('Joined. If the group needs approving, you will be let in shortly.');
      load();
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const ok = await mutate('/api/communities', { method: 'POST', body: { name, area } });
    if (ok) {
      setName('');
      setArea('');
      setCreating(false);
      load();
    }
  }

  async function openPicker(communityId: string) {
    setPickingFor(communityId);
    setMembers([]);
    const res = await fetch(`/api/communities/members?community_id=${communityId}`);
    if (res.ok) setMembers((await res.json()).members ?? []);
  }

  async function nominate(communityId: string, memberId: string | null) {
    const ok = await mutate('/api/communities/successor', {
      method: 'POST',
      body: { community_id: communityId, member_id: memberId },
    });
    if (ok) {
      setPickingFor(null);
      load();
    }
  }

  async function decline(communityId: string) {
    const ok = await mutate(
      `/api/communities/successor?community_id=${communityId}`,
      { method: 'DELETE' }
    );
    if (ok) load();
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <p className="font-bold">Only take work from people you know</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          With this on, only people in your neighborhood groups can book you. It is the
          strongest safety setting here — not because we check them harder, but because
          somebody already vouched for them.
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            className="!mt-0.5 !w-auto"
            checked={only}
            onChange={(e) => toggleOnly(e.target.checked)}
            disabled={busy}
          />
          <span className="font-semibold">Only accept bookings from my groups</span>
        </label>
        {only && active.length === 0 && (
          <div className="mt-2">
            <Notice tone="warn">
              You are not in any group yet, so nobody can book you at all. Join one below,
              or turn this off.
            </Notice>
          </div>
        )}
      </section>

      {error && <Notice tone="error">{error}</Notice>}
      {joined && <Notice tone="success">{joined}</Notice>}

      {nominatedFor.filter((n) => !n.successor_declined_at).map((n) => (
        <section key={n.id} className="card border-brand">
          <p className="font-bold">You&apos;re the backup owner of {n.name}</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            If whoever runs it can no longer do so, the group passes to you — which means
            deciding who joins and who gets removed. It is a real responsibility, and you
            can say no.
          </p>
          <button
            className="btn-secondary mt-2 w-full"
            disabled={busy}
            onClick={() => decline(n.id)}
          >
            No thanks — take my name off
          </button>
        </section>
      ))}

      <section className="card">
        <p className="font-bold">Join a group</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          Someone already in it gives you the code — a neighbor, a family friend, whoever
          runs your street&apos;s group.
        </p>
        <form onSubmit={join} className="mt-3 space-y-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="ABCD-2345"
            className="font-mono uppercase tracking-widest"
            required
          />
          <select value={joinRole} onChange={(e) => setJoinRole(e.target.value)}>
            {MEMBER_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Joining…' : 'Join'}
          </button>
        </form>
      </section>

      <h3 className="text-[13px] font-bold uppercase tracking-wide text-ink-faint">
        Your groups
      </h3>

      {active.length === 0 ? (
        <EmptyState
          title="Not in a group yet"
          hint="Ask a neighbor for a code, or get a parent to start one for your street."
        />
      ) : (
        <ul className="space-y-2">
          {active.map((m) => (
            <li key={m.communityId} className="card">
              <p className="font-semibold">{m.name}</p>
              <p className="text-[13px] text-ink-muted">{m.area}</p>
            </li>
          ))}
        </ul>
      )}

      {memberships.some((m) => m.status === 'pending') && (
        <Notice tone="info">
          Waiting to be let into{' '}
          {memberships.filter((m) => m.status === 'pending').map((m) => m.name).join(', ')}.
        </Notice>
      )}

      {owned.length > 0 && (
        <>
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-ink-faint">
            Groups you run
          </h3>
          <ul className="space-y-2">
            {owned.map((c) => (
              <li key={c.id} className="card">
                <p className="font-semibold">{c.name}</p>
                <p className="text-[13px] text-ink-muted">{c.area}</p>
                <p className="mt-2 select-all rounded-btn bg-gray-50 px-3 py-2 text-center font-mono tracking-widest">
                  {c.invite_code}
                </p>
                <button
                  className="btn-secondary mt-2 w-full"
                  onClick={() => copy(c.invite_code)}
                >
                  {copied === c.invite_code ? 'Copied!' : 'Copy invite code'}
                </button>
                <p className="mt-2 text-[12px] text-ink-faint">
                  Only give this to people you actually know. Whoever has it can join.
                </p>

                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-[13px] font-semibold">If you can&apos;t run it</p>
                  <p className="mt-1 text-[13px] text-ink-muted">
                    Name another adult in the group. If your account is ever closed or
                    suspended, the group passes to them instead of shutting down. Without
                    someone named, it closes — and everyone in it loses it.
                  </p>

                  {c.successor_subscriber_id && !c.successor_declined_at && (
                    <p className="mt-2 text-[13px]">
                      <span className="pill bg-success text-white">named</span>{' '}
                      <button
                        className="ml-1 text-[13px] underline"
                        onClick={() => nominate(c.id, null)}
                      >
                        change
                      </button>
                    </p>
                  )}

                  {c.successor_declined_at && (
                    <div className="mt-2">
                      <Notice tone="warn">
                        The person you named said no. Pick someone else — without a backup
                        this group closes if your account does.
                      </Notice>
                    </div>
                  )}

                  {pickingFor === c.id ? (
                    <div className="mt-2 space-y-2">
                      {members.filter((mem) => mem.canInherit).length === 0 ? (
                        <p className="text-[13px] text-ink-faint">
                          No adult members yet. Whoever takes over has to be an adult with
                          an account, already in the group.
                        </p>
                      ) : (
                        members
                          .filter((mem) => mem.canInherit)
                          .map((mem) => (
                            <button
                              key={mem.id}
                              className="btn-secondary w-full text-left"
                              disabled={busy}
                              onClick={() => nominate(c.id, mem.id)}
                            >
                              {mem.name}
                            </button>
                          ))
                      )}
                      <button
                        className="text-[13px] underline"
                        onClick={() => setPickingFor(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-secondary mt-2 w-full"
                      onClick={() => openPicker(c.id)}
                    >
                      {c.successor_subscriber_id && !c.successor_declined_at
                        ? 'Name someone else'
                        : 'Name a backup owner'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {isAdult ? (
        creating ? (
          <form onSubmit={create} className="card space-y-3">
            <p className="font-bold">Start a group</p>
            <div>
              <label htmlFor="cname">Name</label>
              <input
                id="cname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Maple Street Neighbors"
                required
              />
            </div>
            <div>
              <label htmlFor="carea">Roughly where</label>
              <input
                id="carea"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Maple Street and around"
                required
              />
              {/* Flagged here as well as refused by the route, so someone finds
                  out while they are still typing rather than on submit. */}
              {looksLikeStreetAddress(area) && (
                <p className="mt-1 text-[12px] text-warning">
                  Leave the house number out — everyone in the group sees this.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={busy}>
                {busy ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="btn-secondary w-full" onClick={() => setCreating(true)}>
            Start a group for my neighborhood
          </button>
        )
      ) : (
        <p className="text-[13px] text-ink-faint">
          Running a group means deciding who gets in, so an adult has to own it. Ask a
          parent to start one — you can be the first member.
        </p>
      )}
    </div>
  );
}
