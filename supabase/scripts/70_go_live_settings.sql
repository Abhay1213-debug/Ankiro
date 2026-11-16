-- =====================================================================================
-- 70  GO-LIVE SETTINGS   (run ONCE by the owner in the SQL Editor, when online accounts and requests are being switched on)
-- It only ADDS one piece of reference data. It reads or changes no customer data, and it is safe to run again (it never duplicates).
--   The approved consent version (the owner approved the consent wording on 2026-10-16; the wording is the checkbox text in
--   src/components/ConsultationRequestFlow.tsx). Until a version exists, online requests are refused - by design.
-- No payment details are set here: every payment goes through Dodo Payments' checkout, so the website holds no UPI ID.
-- Expect: "Success. No rows returned." If the editor offers "Run and enable RLS", choose "Run without RLS".
-- =====================================================================================

insert into public.consent_versions (version)
values ('2026-10-v1')
on conflict (version) do nothing;
