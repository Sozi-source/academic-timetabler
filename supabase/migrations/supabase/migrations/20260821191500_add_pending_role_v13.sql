-- ============================================================================
-- Staff Access Provisioning V13 - safe unauthorised role
-- ============================================================================
--
-- This migration is deliberately separate from the next V13 migration.
-- PostgreSQL enum values must be committed before they are used by later
-- functions/defaults.
-- ============================================================================

alter type public.app_role
  add value if not exists 'pending';
