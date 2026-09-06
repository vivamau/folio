CREATE TABLE IF NOT EXISTS MonthlySnapshotCursors (
  user_id INTEGER PRIMARY KEY REFERENCES Users(ID),
  next_month TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS MonthlySnapshots (
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
  UNIQUE(user_id, month)
);
CREATE TABLE IF NOT EXISTS MonthlyExchangeRates (
  month TEXT PRIMARY KEY,
  rates_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_user ON MonthlySnapshots(user_id,month DESC);
CREATE TRIGGER IF NOT EXISTS freeze_snapshot_content
BEFORE UPDATE ON MonthlySnapshots
WHEN OLD.payload_json != NEW.payload_json OR OLD.user_id != NEW.user_id
  OR OLD.month != NEW.month OR OLD.cutoff_date != NEW.cutoff_date
  OR OLD.timezone != NEW.timezone OR OLD.captured_at != NEW.captured_at
  OR OLD.catch_up != NEW.catch_up OR OLD.status = 'ready'
BEGIN
  SELECT RAISE(ABORT, 'Saved monthly snapshots are immutable');
END;
