-- Migration 002: NULL must not satisfy the unable-to-check constraint.
ALTER TABLE observations DROP CONSTRAINT IF EXISTS chk_obs_coherence;
ALTER TABLE observations ADD CONSTRAINT chk_obs_coherence CHECK (
    (kind = 'checked' AND obtainable_quantity IS NOT NULL AND unresolved_reason IS NULL
     AND basis = 'staff_reported_obtainable_count')
    OR
    (kind = 'unable_to_check' AND obtainable_quantity IS NULL AND observed_at IS NULL
     AND unresolved_reason IS NOT DISTINCT FROM 'cannot_check'
     AND basis = 'unable_to_check')
);
