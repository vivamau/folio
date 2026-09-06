-- Replace the unconditional user/month uniqueness with monthly-only uniqueness.
-- All existing IDs and immutable payloads are preserved in this transaction.
CREATE TABLE IF NOT EXISTS MonthlySnapshots_new (
  ID INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES Users(ID),
  month TEXT NOT NULL,
  cutoff_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  catch_up INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready')),
  rates_json TEXT,
  totals_json TEXT,
  completed_at TEXT,
  next_retry_at INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'monthly' CHECK(kind IN ('monthly','ad_hoc')),
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT ''
);
INSERT INTO MonthlySnapshots_new
  (ID,user_id,month,cutoff_date,timezone,captured_at,catch_up,payload_json,status,rates_json,totals_json,completed_at,next_retry_at,from_date,to_date)
SELECT ID,user_id,month,cutoff_date,timezone,captured_at,catch_up,payload_json,status,rates_json,totals_json,completed_at,next_retry_at,month || '-01',cutoff_date
FROM MonthlySnapshots;
DROP TABLE MonthlySnapshots;
ALTER TABLE MonthlySnapshots_new RENAME TO MonthlySnapshots;
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_snapshot_unique ON MonthlySnapshots(user_id,month) WHERE kind='monthly';
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_user ON MonthlySnapshots(user_id,captured_at DESC,ID DESC);
CREATE TRIGGER IF NOT EXISTS freeze_snapshot_content
BEFORE UPDATE ON MonthlySnapshots
WHEN OLD.payload_json != NEW.payload_json OR OLD.user_id != NEW.user_id
  OR OLD.month != NEW.month OR OLD.cutoff_date != NEW.cutoff_date
  OR OLD.timezone != NEW.timezone OR OLD.captured_at != NEW.captured_at
  OR OLD.catch_up != NEW.catch_up OR OLD.kind != NEW.kind
  OR OLD.from_date != NEW.from_date OR OLD.to_date != NEW.to_date
  OR OLD.title != NEW.title OR OLD.status = 'ready'
BEGIN
  SELECT RAISE(ABORT, 'Saved summaries are immutable');
END;
CREATE TABLE IF NOT EXISTS SnapshotExchangeRates (
  reference_date TEXT PRIMARY KEY,
  rates_json TEXT NOT NULL
);
INSERT INTO SnapshotExchangeRates (reference_date,rates_json)
SELECT date(month || '-01','+1 month','-1 day'),rates_json FROM MonthlyExchangeRates;
DROP TABLE MonthlyExchangeRates;
