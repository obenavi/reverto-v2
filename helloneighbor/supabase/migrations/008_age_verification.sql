-- Facial age estimation.
--
-- Two things this schema deliberately does NOT have: a column for a face
-- image, and a column for a biometric template. The image is streamed to the
-- estimation provider and discarded; only the numeric result is kept.
--
-- That is the single most important mitigation here. A stored faceprint is a
-- biometric identifier under Illinois BIPA (private right of action, statutory
-- damages per violation), Texas CUBI, and Washington's equivalent, and special
-- category data under GDPR Article 9. Storing an estimate is not.

create table if not exists age_verifications (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  subscriber_id     uuid not null references subscribers (id) on delete cascade,

  method            text not null check (method in ('estimate','document','manual')),
  provider          text,

  -- What the provider returned. estimated_age is deliberately numeric: these
  -- models return a distribution, not an integer birthday.
  estimated_age     numeric(4,1),
  confidence        numeric(4,3) check (confidence between 0 and 1),

  declared_age      integer not null,
  -- Whether the estimate is consistent with what they typed, within the
  -- provider's stated error margin.
  consistent        boolean,
  -- Whether they clear the platform minimum with margin to spare.
  meets_minimum     boolean,

  status            text not null default 'pending'
                      check (status in ('pending','passed','review','failed','error')),
  detail            text,

  reviewed_by       text,
  reviewed_at       timestamptz
);

create index if not exists age_verifications_subscriber_idx
  on age_verifications (subscriber_id, created_at desc);
create index if not exists age_verifications_open_idx
  on age_verifications (status, created_at desc) where status in ('pending','review');

alter table subscribers
  add column if not exists age_verification_status text
    check (age_verification_status in ('unverified','pending','passed','review','failed')),
  add column if not exists age_verified_at        timestamptz,
  add column if not exists age_estimated          numeric(4,1),
  -- BIPA-shaped: notice given, consent recorded, with the time and source.
  add column if not exists biometric_consent_at   timestamptz,
  add column if not exists biometric_consent_ip   text;

alter table age_verifications enable row level security;
revoke all on age_verifications from anon, authenticated;
