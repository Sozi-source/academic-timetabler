-- Clear and revoke legacy trainer link tokens to enforce authenticated portal mark entry
-- All active link-based invites are revoked.
update public.assessment_trainer_mark_invites
set revoked_at = coalesce(revoked_at, now())
where revoked_at is null;

-- Detach legacy source_trainer_invite_id references on online mark drafts
update public.assessment_online_mark_drafts
set source_trainer_invite_id = null
where source_trainer_invite_id is not null;
