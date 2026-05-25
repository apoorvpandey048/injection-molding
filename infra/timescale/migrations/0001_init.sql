-- Initial schema for the IMM PdM platform.
-- Grounded in §10 of docs/plan.md and ADR-0001 (channel taxonomy).

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Static config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machines (
    id           TEXT PRIMARY KEY,
    model        TEXT,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meta         JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE IF NOT EXISTS components (
    id                    SERIAL PRIMARY KEY,
    machine_id            TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    kind                  TEXT NOT NULL, -- hydraulic | screw | mold | heater | motor | clamp | bearing
    installed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_life_cycles  INT,
    meta                  JSONB NOT NULL DEFAULT '{}'::JSONB,
    UNIQUE (machine_id, name)
);

-- ---------------------------------------------------------------------------
-- Raw telemetry — high-rate, long form. Compressed after 1d, retained 30d.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_telemetry (
    ts          TIMESTAMPTZ        NOT NULL,
    machine_id  TEXT               NOT NULL,
    channel     TEXT               NOT NULL,
    value       DOUBLE PRECISION   NOT NULL
);
SELECT create_hypertable(
    'raw_telemetry', 'ts',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);
CREATE INDEX IF NOT EXISTS raw_telemetry_machine_channel_ts
    ON raw_telemetry (machine_id, channel, ts DESC);
ALTER TABLE raw_telemetry SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'machine_id,channel'
);
SELECT add_compression_policy('raw_telemetry', INTERVAL '1 day', if_not_exists => TRUE);
SELECT add_retention_policy  ('raw_telemetry', INTERVAL '30 days', if_not_exists => TRUE);

-- ---------------------------------------------------------------------------
-- Cycles — one row per molding cycle. Curves stored in MinIO; only URI here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cycles (
    cycle_id        BIGINT          NOT NULL,
    machine_id      TEXT            NOT NULL,
    t_start         TIMESTAMPTZ     NOT NULL,
    t_end           TIMESTAMPTZ,
    phases          JSONB           NOT NULL DEFAULT '{}'::JSONB,
    setpoints       JSONB           NOT NULL DEFAULT '{}'::JSONB,
    scalars         JSONB           NOT NULL DEFAULT '{}'::JSONB, -- per-cycle scalar tags (see channels.py)
    curves_blob_uri TEXT,
    PRIMARY KEY (machine_id, cycle_id, t_start)
);
SELECT create_hypertable(
    'cycles', 't_start',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);
CREATE INDEX IF NOT EXISTS cycles_machine_t ON cycles (machine_id, t_start DESC);

-- ---------------------------------------------------------------------------
-- Features — wide table. Columns added by migrations as the FE library grows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS features (
    t_end       TIMESTAMPTZ NOT NULL,
    machine_id  TEXT        NOT NULL,
    cycle_id    BIGINT      NOT NULL,
    payload     JSONB       NOT NULL, -- {feature_name: value, ...}
    PRIMARY KEY (machine_id, cycle_id, t_end)
);
SELECT create_hypertable(
    'features', 't_end',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);
CREATE INDEX IF NOT EXISTS features_machine_t ON features (machine_id, t_end DESC);

-- ---------------------------------------------------------------------------
-- Predictions — anomaly | quality | health | rul, all in one hypertable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS predictions (
    t              TIMESTAMPTZ NOT NULL,
    machine_id     TEXT        NOT NULL,
    cycle_id       BIGINT,
    kind           TEXT        NOT NULL, -- anomaly | quality | health | rul
    component      TEXT,                  -- nullable for machine-level preds
    payload        JSONB       NOT NULL,
    model_name     TEXT        NOT NULL,
    model_version  TEXT        NOT NULL
);
SELECT create_hypertable(
    'predictions', 't',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);
CREATE INDEX IF NOT EXISTS predictions_machine_kind_t
    ON predictions (machine_id, kind, t DESC);

-- ---------------------------------------------------------------------------
-- Alerts and maintenance log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id  TEXT NOT NULL,
    component   TEXT,
    severity    TEXT NOT NULL, -- info | warning | critical
    kind        TEXT NOT NULL, -- anomaly | health_low | rul_short | quality_risk | ...
    opened_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at   TIMESTAMPTZ,
    acked_by    TEXT,
    acked_at    TIMESTAMPTZ,
    payload     JSONB NOT NULL DEFAULT '{}'::JSONB
);
CREATE INDEX IF NOT EXISTS alerts_machine_open
    ON alerts (machine_id, opened_at DESC)
    WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS maintenance_log (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id    TEXT NOT NULL,
    component_id  INT REFERENCES components(id) ON DELETE SET NULL,
    performed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action        TEXT NOT NULL, -- replace | inspect | clean | adjust
    technician    TEXT,
    notes         TEXT,
    payload       JSONB NOT NULL DEFAULT '{}'::JSONB
);
CREATE INDEX IF NOT EXISTS maintenance_log_machine
    ON maintenance_log (machine_id, performed_at DESC);
