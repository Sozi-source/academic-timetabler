-- Retire the legacy generic scheduling-constraints workflow.
-- Trainer recurring availability is managed by trainer_availability.
-- Fixed unit day/session requirements are managed by teaching allocations.
-- Keep historical rows for audit, but prevent them from blocking scheduling.

update public.scheduling_constraints
set is_active = false
where is_active = true;
