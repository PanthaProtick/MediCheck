-- Migration: 001_multi_user
-- Applied at: Versioned ledger
-- Database: PostgreSQL 15+ (Neon compatible)

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    auth_subject TEXT UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pharmacies (
    id TEXT PRIMARY KEY CHECK (id ~ '^[A-Z][A-Z0-9-]{0,63}$'),
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    simulated BOOLEAN NOT NULL DEFAULT TRUE CHECK (simulated = TRUE)
);

CREATE TABLE IF NOT EXISTS pharmacy_memberships (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id) ON DELETE RESTRICT,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role = 'staff'),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, pharmacy_id)
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY CHECK (id ~ '^[A-Z][A-Z0-9-]{0,63}$'),
    name TEXT NOT NULL,
    strength TEXT NOT NULL,
    form TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('tablet', 'capsule'))
);

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY CHECK (id ~ '^[A-Z][A-Z0-9-]{0,63}$'),
    pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NULL CHECK (quantity IS NULL OR (quantity >= 0 AND quantity <= 10000)),
    unit TEXT NOT NULL CHECK (unit IN ('tablet', 'capsule')),
    recorded_at TIMESTAMPTZ NULL,
    loaded_at TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL,
    simulated BOOLEAN NOT NULL DEFAULT TRUE CHECK (simulated = TRUE),
    CONSTRAINT uq_pharmacy_product UNIQUE (pharmacy_id, product_id)
);

CREATE TABLE IF NOT EXISTS enquiries (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    requested_quantity INTEGER NOT NULL CHECK (requested_quantity >= 1 AND requested_quantity <= 10000),
    unit TEXT NOT NULL CHECK (unit IN ('tablet', 'capsule')),
    created_at TIMESTAMPTZ NOT NULL,
    product_snapshot_json TEXT NOT NULL,
    claim_snapshot_json TEXT NULL
);

CREATE TABLE IF NOT EXISTS observations (
    enquiry_id UUID PRIMARY KEY REFERENCES enquiries(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    unit TEXT NOT NULL CHECK (unit IN ('tablet', 'capsule')),
    kind TEXT NOT NULL CHECK (kind IN ('checked', 'unable_to_check')),
    obtainable_quantity INTEGER NULL CHECK (obtainable_quantity IS NULL OR (obtainable_quantity >= 0 AND obtainable_quantity <= 10000)),
    observed_at TIMESTAMPTZ NULL,
    unresolved_reason TEXT NULL CHECK (unresolved_reason IS NULL OR unresolved_reason = 'cannot_check'),
    reported_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ NOT NULL,
    basis TEXT NOT NULL CHECK (basis IN ('staff_reported_obtainable_count', 'unable_to_check')),
    simulated BOOLEAN NOT NULL DEFAULT TRUE CHECK (simulated = TRUE),
    CONSTRAINT chk_obs_coherence CHECK (
        (kind = 'checked' AND obtainable_quantity IS NOT NULL AND unresolved_reason IS NULL AND basis = 'staff_reported_obtainable_count') OR
        (kind = 'unable_to_check' AND obtainable_quantity IS NULL AND observed_at IS NULL AND unresolved_reason = 'cannot_check' AND basis = 'unable_to_check')
    )
);

CREATE INDEX IF NOT EXISTS idx_enquiries_owner ON enquiries (owner_user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_pharmacy_pending ON enquiries (pharmacy_id, created_at ASC, id ASC);
