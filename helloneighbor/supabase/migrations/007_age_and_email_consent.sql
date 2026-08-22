-- Age floor 13, no ceiling; guardian consent under 16, by email.
--
-- 13 is the line that matters: COPPA governs under-13, so this puts the whole
-- user base outside it. Removing the upper bound lets adults operate too, which
-- is why the booking page now says plainly when a provider is a minor.

alter table subscribers drop constraint if exists subscribers_age_check;
alter table subscribers add constraint subscribers_age_check
  check (age >= 13 and age <= 120);

-- The operator's own email. Needed so a guardian's address can be required to
-- be a *different* one — a minor using their own second address as the
-- "parent" is the obvious way to defeat consent.
alter table subscribers
  add column if not exists email text;

-- Consent is now delivered by email rather than SMS.
alter table subscribers
  add column if not exists guardian_consent_sent_at timestamptz;

-- Guardian email must differ from the operator's own, case-insensitively.
alter table subscribers drop constraint if exists subscribers_guardian_email_distinct;
alter table subscribers add constraint subscribers_guardian_email_distinct
  check (
    guardian_email is null
    or email is null
    or lower(guardian_email) <> lower(email)
  );
