import React, { useEffect, useState, useCallback } from "react";
import {
  CalendarDays,
  ArrowRight,
  RefreshCw,
  LockKeyhole,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "./api";
import { money, currencies, today } from "./format";
import Modal from "./Modal";
import SummaryBreakdowns from "./SummaryBreakdowns";
const summaryName = (snapshot) =>
  snapshot.kind === "ad_hoc"
    ? snapshot.title || `${snapshot.fromDate} – ${snapshot.toDate}`
    : monthName(snapshot.month);
const monthName = (month) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
export default function Snapshots() {
  const [snapshots, setSnapshots] = useState([]),
    [selected, setSelected] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [creating, setCreating] = useState(false),
    [saving, setSaving] = useState(false),
    [creationError, setCreationError] = useState("");
  const [deleting, setDeleting] = useState(null),
    [removing, setRemoving] = useState(false),
    [deleteError, setDeleteError] = useState("");
  const closeDeletion = useCallback(() => {
    if (!removing) setDeleting(null);
  }, [removing]);
  async function remove() {
    setRemoving(true);
    setDeleteError("");
    try {
      await api.delete(`/snapshots/${deleting.id}`);
      setSnapshots((current) =>
        current.filter((snapshot) => snapshot.id !== deleting.id),
      );
      setSelected((current) => (current?.id === deleting.id ? null : current));
      setDeleting(null);
    } catch (error) {
      setDeleteError(
        error.response?.data?.error ||
          "Unable to delete the summary. Please try again.",
      );
    } finally {
      setRemoving(false);
    }
  }
  const closeCreation = useCallback(() => {
    if (!saving) setCreating(false);
  }, [saving]);
  async function create(input) {
    setSaving(true);
    setCreationError("");
    try {
      const { data } = await api.post("/snapshots", input);
      setSnapshots((current) => [data, ...current]);
      setSelected(data);
      setCreating(false);
      setError("");
    } catch (error) {
      setCreationError(
        error.response?.data?.error ||
          "Unable to create the summary. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setSnapshots((await api.get("/snapshots")).data);
      setSelected(null);
    } catch {
      setError("Unable to load monthly summaries. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  async function open(id) {
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      setSelected((await api.get(`/snapshots/${id}`)).data);
    } catch {
      setError("Unable to open this summary. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  return (
    <section className="snapshots-section">
      <div className="snapshot-intro">
        <p>
          <LockKeyhole size={15} />
          Saved pictures of your spending. Later edits won’t change it.
        </p>
        <div className="snapshot-actions">
          <button
            className="button primary"
            onClick={() => {
              setCreationError("");
              setCreating(true);
            }}
          >
            <Plus size={16} />
            Create summary
          </button>
          <button className="text-button" onClick={refresh} disabled={loading}>
            <RefreshCw size={15} />
            Refresh summaries
          </button>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="muted" role="status">
          Loading monthly summaries…
        </p>
      )}
      {!loading && !error && !snapshots.length && (
        <div className="panel snapshot-empty">
          <CalendarDays size={35} />
          <h2>Your first monthly picture is on its way</h2>
          <p>
            Create a summary now for any date range, or let the system save one
            automatically after the month ends.
          </p>
        </div>
      )}
      <div className="snapshot-layout">
        <div className="snapshot-months">
          {snapshots.map((snapshot) => (
            <button
              key={snapshot.id}
              className={`snapshot-month ${selected?.id === snapshot.id ? "selected" : ""}`}
              onClick={() => open(snapshot.id)}
            >
              <span className="eyebrow">
                {snapshot.kind === "ad_hoc" ? "AD HOC" : "MONTHLY"} ·{" "}
                {snapshot.status === "ready" ? "SAVED" : "RATES PENDING"}
              </span>
              <strong>{summaryName(snapshot)}</strong>
              <span>
                {snapshot.invoiceCount}{" "}
                {snapshot.invoiceCount === 1 ? "expense" : "expenses"}{" "}
                <ArrowRight size={15} />
              </span>
            </button>
          ))}
        </div>
        {selected ? (
          <SnapshotDetail
            snapshot={selected}
            onDelete={() => {
              setDeleteError("");
              setDeleting(selected);
            }}
          />
        ) : (
          snapshots.length > 0 &&
          !loading && (
            <div className="panel snapshot-empty">
              <CalendarDays size={30} />
              <h2>Select a summary</h2>
              <p>Explore its frozen expenses and saved currency values.</p>
            </div>
          )
        )}
      </div>
      {deleting && (
        <Modal title="Delete this ad hoc summary?" onClose={closeDeletion}>
          <p>
            Permanently delete {summaryName(deleting)}? Your expenses and
            automatic monthly summaries will remain unchanged.
          </p>
          {deleteError && (
            <p className="notice error" role="alert">
              {deleteError}
            </p>
          )}
          <footer className="form-footer">
            <button
              className="button secondary"
              disabled={removing}
              onClick={closeDeletion}
            >
              Keep summary
            </button>
            <button
              className="button danger"
              disabled={removing}
              onClick={remove}
            >
              {removing ? "Deleting…" : "Delete permanently"}
            </button>
          </footer>
        </Modal>
      )}
      {creating && (
        <Modal title="Create summary" onClose={closeCreation}>
          <AdHocForm onSave={create} saving={saving} error={creationError} />
        </Modal>
      )}
    </section>
  );
}
function SnapshotDetail({ snapshot, onDelete }) {
  return (
    <article className="panel snapshot-detail">
      <header>
        <div>
          <span className="eyebrow">
            {snapshot.kind === "ad_hoc" ? "AD HOC PICTURE" : "MONTHLY PICTURE"}
          </span>
          <h2>{summaryName(snapshot)}</h2>
        </div>
        {snapshot.kind === "ad_hoc" ? (
          <button className="text-button" onClick={onDelete}>
            <Trash2 size={16} />
            Delete summary
          </button>
        ) : (
          <LockKeyhole size={20} />
        )}
      </header>
      <p className="snapshot-meta">
        Captured{" "}
        {new Date(snapshot.capturedAt).toLocaleString("en-GB", {
          timeZone: snapshot.timeZone,
        })}{" "}
        · {snapshot.timeZone}
      </p>
      {snapshot.kind === "ad_hoc" && (
        <p className="snapshot-meta">
          Period: {snapshot.fromDate} to {snapshot.toDate} · Created on demand
        </p>
      )}
      {snapshot.catchUp && (
        <p className="notice">
          Captured after month-end when the server caught up. Reflects the
          records available at capture time.
        </p>
      )}
      {snapshot.unpricedCount > 0 && (
        <p className="notice">
          {snapshot.unpricedCount}{" "}
          {snapshot.unpricedCount === 1 ? "expense is" : "expenses are"} missing
          prices and excluded from totals.
        </p>
      )}
      <h3>Original spending</h3>
      <div className="snapshot-original">
        {Object.entries(snapshot.originalTotals).length ? (
          Object.entries(snapshot.originalTotals).map(([currency, total]) => (
            <span key={currency}>
              {money(total, currency)} <small>{currency}</small>
            </span>
          ))
        ) : (
          <span>No priced expenses this month.</span>
        )}
      </div>
      <h3>
        {snapshot.kind === "ad_hoc"
          ? "Period-end conversions"
          : "Month-end conversions"}
      </h3>
      <p className="snapshot-meta">
        Each amount below is the same combined spending expressed in a different
        currency.
      </p>
      {snapshot.status === "pending" ? (
        <p className="notice">
          Exchange rates are pending. Your expenses are already saved;
          conversion retries automatically each hour.
        </p>
      ) : (
        <>
          <div className="snapshot-totals">
            {currencies.map((currency) => (
              <div key={currency}>
                <span>{currency}</span>
                <strong>{money(snapshot.totals[currency], currency)}</strong>
              </div>
            ))}
          </div>
          <details className="snapshot-rates" open>
            <summary>Saved exchange rates</summary>
            <p>
              Reference date: {snapshot.cutoffDate}. Source:{" "}
              <a
                href="https://frankfurter.dev/"
                target="_blank"
                rel="noreferrer"
              >
                Frankfurter
              </a>
              . Rates are estimates; weekends and holidays may use earlier
              published rates.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>CURRENCY</th>
                    <th>PER 1 EUR</th>
                    <th>RATE DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((currency) => (
                    <tr key={currency}>
                      <td>{currency}</td>
                      <td>{snapshot.rates.rates[currency]}</td>
                      <td>{snapshot.rates.dates[currency]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <SummaryBreakdowns key={snapshot.id} snapshot={snapshot} />
      <h3>
        Saved expenses{" "}
        <span className="count-badge">{snapshot.invoiceCount}</span>
      </h3>
      <div className="snapshot-expenses">
        {snapshot.invoices.map((invoice) => (
          <details key={invoice.id}>
            <summary>
              <span>
                <strong>{invoice.shop}</strong>
                <small>
                  {invoice.date} · {invoice.notes || "Expense"}
                </small>
              </span>
              <strong>
                {invoice.totalCents === null
                  ? "Needs pricing"
                  : money(invoice.totalCents, invoice.currency)}
              </strong>
            </summary>
            {invoice.lines.map((line, index) => (
              <p key={index}>
                {line.name} · {line.category} · {line.quantity} ×{" "}
                {line.unitPriceCents === null
                  ? "Unpriced"
                  : money(line.unitPriceCents, invoice.currency)}
              </p>
            ))}
          </details>
        ))}
      </div>
    </article>
  );
}

function AdHocForm({ onSave, saving, error }) {
  const currentDate = today();
  const [title, setTitle] = useState(""),
    [from, setFrom] = useState(`${currentDate.slice(0, 7)}-01`),
    [to, setTo] = useState(currentDate);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ title, from, to });
      }}
    >
      <p className="snapshot-meta">
        Save the expenses in this period as they are now. Currency conversions
        use reference rates for the end date. This does not replace your
        automatic monthly summary.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <label>
        Summary title
        <input
          maxLength={120}
          value={title}
          placeholder="Optional, e.g. Trip costs"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="form-grid">
        <label>
          Start date
          <input
            type="date"
            required
            max={to}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            required
            min={from}
            max={currentDate}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>
      <footer className="form-footer">
        <span>Saved summaries stay unchanged.</span>
        <button className="button primary" disabled={saving}>
          {saving ? "Saving summary…" : "Save summary"}
        </button>
      </footer>
    </form>
  );
}
