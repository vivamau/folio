import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  Store,
  Plus,
  LogOut,
  Search,
  ArrowRight,
  Pencil,
  Trash2,
  BookOpen,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { api } from "./api";
import { currencies, money, initialCurrency } from "./format";
import Modal from "./Modal";
import ExpenseForm from "./ExpenseForm";
import Catalog, {
  CatalogForm,
  ItemCategoryForm,
  catalogKinds,
} from "./Catalog";
import Dashboard from "./Dashboard";
import Snapshots from "./Snapshots";
const errorMessage = (error) =>
  error.response?.data?.error || "Unable to connect. Please try again.";
export default function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [invoices, setInvoices] = useState([]),
    [catalog, setCatalog] = useState({
      shops: [],
      items: [],
      categories: [],
      manufacturers: [],
    });
  const [view, setView] = useState("overview"),
    [currency, setCurrency] = useState("EUR"),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [modal, setModal] = useState(null),
    [saving, setSaving] = useState(false);
  const close = useCallback(() => setModal(null), []);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      api.get("/invoices"),
      api.get("/catalog"),
    ]);
    setInvoices(a.data);
    setCatalog(b.data);
    return a.data;
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/me");
        setUser(data);
        setCurrency(initialCurrency(await load(), data.defaultCurrency));
      } catch (e) {
        if (e.response?.status !== 401 && e.message !== "Unauthorized")
          setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);
  async function login(credentials) {
    setError("");
    setSaving(true);
    try {
      await api.post("/login", credentials);
      const { data } = await api.get("/me");
      setUser(data);
      setCurrency(initialCurrency(await load(), data.defaultCurrency));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  async function logout() {
    try {
      await api.post("/logout");
      setUser(null);
      setInvoices([]);
      setModal(null);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function save(data) {
    setSaving(true);
    setError("");
    try {
      if (modal.type === "expense") {
        if (modal.invoice) await api.put(`/invoices/${modal.invoice.id}`, data);
        else await api.post("/invoices", data);
        setCurrency(data.currency);
        setSearch("");
        setFrom("");
        setTo("");
        if (view === "catalog" || view === "snapshots") setView("expenses");
      } else if (modal.type === "item-category") {
        await api.patch(`/items/${modal.item.id}/category`, data);
      } else if (modal.type === "delete-shop") {
        await api.delete(`/shops/${modal.shop.id}`);
      } else if (modal.type === "delete") {
        await api.delete(`/invoices/${modal.invoice.id}`);
      } else {
        await api.post(`/${catalogKinds[modal.type]}`, data);
      }
      setModal(null);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  if (loading)
    return (
      <div className="loading-screen">
        <BookOpen size={36} />
        <span>Opening your ledger…</span>
      </div>
    );
  if (!user) return <Login onLogin={login} error={error} saving={saving} />;
  const filtered = invoices.filter(
    (i) =>
      i.currency === currency &&
      (!from || i.date >= from) &&
      (!to || i.date <= to) &&
      [i.shop, i.notes, ...i.lines.map((l) => l.name)]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const headers = {
    overview: [
      "YOUR MONEY, IN PERSPECTIVE",
      "Spending overview",
      "A clearer view of your everyday spending.",
    ],
    expenses: [
      "EVERY PURCHASE HAS A PLACE",
      "Your expense ledger",
      "The details that make up your day to day.",
    ],
    snapshots: [
      "YOUR MONTH, PRESERVED",
      "Monthly summaries",
      "A lasting picture of your spending, in every supported currency.",
    ],
    catalog: [
      "A LITTLE ORGANIZATION GOES A LONG WAY",
      "Your everyday essentials",
      "Manage the shops, items and categories behind your expenses.",
    ],
  };
  const [eyebrow, title, subtitle] = headers[view];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("overview");
          }}
        >
          <span className="brand-mark">
            <BookOpen size={25} />
          </span>
          folio<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          {[
            ["overview", "Overview", LayoutDashboard],
            ["expenses", "Expenses", Receipt],
            ["catalog", "Shops & items", Store],
            ["snapshots", "Monthly summaries", CalendarDays],
          ].map(([key, label, Icon]) => (
            <button
              className={view === key ? "active" : ""}
              key={key}
              onClick={() => setView(key)}
            >
              <Icon size={19} />
              {label}
              {view === key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-spark">✳</span>
          <h3>
            Small entries.
            <br />A bigger picture.
          </h3>
          <p>
            Make room for the things
            <br />
            that matter to you.
          </p>
          <div className="note-line" />
        </div>
        <div className="user-card">
          <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>
              {user.canManage ? "Administrator" : "Personal account"}
            </small>
          </div>
          <button aria-label="Sign out" onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <span>
            Workspace <ChevronRight size={13} />{" "}
            {view === "snapshots"
              ? "Monthly summaries"
              : view === "catalog"
                ? "Shops & items"
                : view === "expenses"
                  ? "Expenses"
                  : "Overview"}
          </span>
          <span className="private-label">
            <i />
            Private & personal
          </span>
        </div>
        <div className="page-content">
          <header className="page-heading">
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setError("");
                setModal({ type: "expense" });
              }}
            >
              <Plus size={18} />
              Add expense
            </button>
          </header>
          {error && !modal && (
            <div className="notice error" role="alert">
              {error}
              <button
                onClick={() => {
                  setError("");
                  load().catch((e) => setError(errorMessage(e)));
                }}
              >
                Retry
              </button>
            </div>
          )}
          {(view === "overview" || view === "expenses") && (
            <div className="filter-bar">
              <div className="period-label">
                Your ledger <span>/</span>{" "}
                <strong>{from || to ? "Selected period" : "All time"}</strong>
              </div>
              <div className="date-filters">
                <label>
                  <span>From</span>
                  <input
                    aria-label="From date"
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <span className="date-dash">–</span>
                <label>
                  <span>To</span>
                  <input
                    aria-label="To date"
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
                <label className="currency-control">
                  <span className="sr-only">Currency</span>
                  <select
                    aria-label="Currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {currencies.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}
          {view === "overview" && (
            <Dashboard invoices={filtered} currency={currency} />
          )}
          {view === "snapshots" ? (
            <Snapshots />
          ) : view === "catalog" ? (
            <Catalog
              invoices={invoices}
              catalog={catalog}
              canManage={user.canManage}
              onChangeCategory={(item) => {
                setError("");
                setModal({ type: "item-category", item });
              }}
              onDeleteShop={(shop) => {
                setError("");
                setModal({ type: "delete-shop", shop });
              }}
              onAdd={(type) => {
                setError("");
                setModal({ type });
              }}
            />
          ) : (
            <section className="panel ledger-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {view === "overview" ? "Recent expenses" : "All expenses"}{" "}
                    <span className="count-badge">{filtered.length}</span>
                  </h2>
                  <p className="panel-subtitle">
                    {view === "overview"
                      ? "Your latest entries, all in one place."
                      : "A record of every little thing."}
                  </p>
                </div>
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search expenses"
                    placeholder="Search your expenses…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              {filtered.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>SHOP / DESCRIPTION</th>
                        <th>DATE</th>
                        <th>ITEMS</th>
                        <th className="amount">AMOUNT</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered
                        .slice(0, view === "overview" ? 5 : filtered.length)
                        .map((invoice) => (
                          <tr key={invoice.id}>
                            <td>
                              <div className="shop-cell">
                                <span className="shop-icon">
                                  <Store size={18} />
                                </span>
                                <div>
                                  <strong>{invoice.shop}</strong>
                                  <small>
                                    {invoice.notes ||
                                      invoice.lines
                                        .map((l) => l.name)
                                        .join(", ")}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td className="date-cell">
                              {new Date(
                                `${invoice.date}T12:00:00`,
                              ).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td>
                              <span className="subtle-pill">
                                {invoice.lines.length}{" "}
                                {invoice.lines.length === 1 ? "item" : "items"}
                              </span>
                            </td>
                            <td className="amount">
                              <strong>
                                {invoice.totalCents === null
                                  ? "Needs pricing"
                                  : money(invoice.totalCents, invoice.currency)}
                              </strong>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  aria-label={`Edit expense ${invoice.id}`}
                                  onClick={() => {
                                    setError("");
                                    setModal({ type: "expense", invoice });
                                  }}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`Delete expense ${invoice.id}`}
                                  onClick={() => {
                                    setError("");
                                    setModal({ type: "delete", invoice });
                                  }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-ledger">
                  <div className="empty-receipt">
                    <Receipt size={30} />
                  </div>
                  <h3>No expenses found</h3>
                  <p>
                    {search || from || to
                      ? "Try changing your search or date range."
                      : "Your first entry is the start of a clearer picture."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setError("");
                      setModal({ type: "expense" });
                    }}
                  >
                    Record an expense
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
              {view === "overview" && filtered.length > 5 && (
                <button
                  className="ledger-footer"
                  onClick={() => setView("expenses")}
                >
                  View all expenses <ArrowRight size={15} />
                </button>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>
              folio. <span>A little clarity, every day.</span>
            </span>
            <span>
              {view === "snapshots"
                ? "Exchange rates preserved with each summary"
                : view === "catalog"
                  ? "Your all-time spending by currency. No currency conversion."
                  : `Amounts shown in ${currency}. No currency conversion.`}
            </span>
          </footer>
        </div>
      </main>
      {modal && (
        <Modal
          title={
            modal.type === "expense"
              ? modal.invoice
                ? "Edit expense"
                : "New expense"
              : modal.type === "delete"
                ? "Delete this expense?"
                : modal.type === "delete-shop"
                  ? "Delete this shop?"
                  : modal.type === "item-category"
                    ? "Change item category"
                    : `Add ${modal.type}`
          }
          onClose={close}
        >
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {modal.type === "item-category" ? (
            <ItemCategoryForm
              item={modal.item}
              catalog={catalog}
              onSave={save}
              saving={saving}
            />
          ) : modal.type === "expense" ? (
            <ExpenseForm
              invoice={modal.invoice}
              catalog={catalog}
              currency={currency}
              onSave={save}
              saving={saving}
            />
          ) : ["delete", "delete-shop"].includes(modal.type) ? (
            <>
              <p>
                {modal.type === "delete-shop"
                  ? `Permanently remove ${modal.shop.name}? Shops can only be deleted when no expenses are related to them.`
                  : `This will permanently remove the expense from ${modal.invoice.shop} and its items.`}
              </p>
              <footer className="form-footer">
                <button className="button secondary" onClick={close}>
                  {modal.type === "delete-shop" ? "Keep shop" : "Keep expense"}
                </button>
                <button
                  className="button danger"
                  disabled={saving}
                  onClick={() => save()}
                >
                  {saving ? "Deleting…" : "Delete permanently"}
                </button>
              </footer>
            </>
          ) : (
            <CatalogForm
              kind={modal.type}
              catalog={catalog}
              onSave={save}
              saving={saving}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
function Login({ onLogin, error, saving }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState("");
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <BookOpen size={31} />
          folio.
        </div>
        <div>
          <span className="eyebrow">A LITTLE CLARITY, EVERY DAY</span>
          <h1>
            Know where
            <br />
            it all goes.
          </h1>
          <p>
            A considered home for your everyday spending.
            <br />
            Every purchase, part of the bigger picture.
          </p>
          <div className="login-art" aria-hidden="true">
            <span>THE EVERYDAY LEDGER</span>
            <i />
            <i />
            <i />
            <strong>
              Less guesswork.
              <br />
              More perspective.
            </strong>
          </div>
        </div>
        <small>YOUR MONEY. YOUR PERSPECTIVE.</small>
      </section>
      <section className="login-form">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin({ username, password });
          }}
        >
          <span className="eyebrow">WELCOME TO FOLIO</span>
          <h2>Your ledger awaits.</h2>
          <p>Sign in to pick up where you left off.</p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <label>
            Username
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={saving}>
            {saving ? "Signing in…" : "Sign in"}
            <ArrowRight size={17} />
          </button>
          <small className="login-help">
            Use your existing account credentials.
            <br />
            Contact your administrator if you need access.
          </small>
        </form>
      </section>
    </div>
  );
}
