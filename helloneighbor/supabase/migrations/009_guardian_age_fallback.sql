-- Guardian attestation as the fallback when the face check cannot settle an age.
--
-- The two are different kinds of evidence and it is worth being clear about
-- which is which. The face check is a *measurement* — weak proof, but nobody's
-- word. A guardian attestation is a *statement of responsibility* by a named
-- adult who accepts liability for the account. It does not prove the age; it
-- puts an accountable person behind it. Together they cover each other's gap.

alter table age_verifications drop constraint if exists age_verifications_method_check;
alter table age_verifications add constraint age_verifications_method_check
  check (method in ('estimate','document','manual','guardian'));

alter table subscribers
  -- The guardian explicitly took responsibility, as opposed to merely
  -- permitting the account. Recorded separately because it is the part that
  -- carries legal weight.
  add column if not exists guardian_responsibility_at timestamptz,
  -- The age the guardian confirmed, which can differ from the declared one.
  add column if not exists guardian_confirmed_age     integer,
  -- Set when a guardian link is sent specifically to settle an age check
  -- rather than as the routine under-16 consent.
  add column if not exists guardian_age_check_sent_at timestamptz;
