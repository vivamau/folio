import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { currencies, money, today, lineTotal } from "./format";
export default function ExpenseForm({
  invoice,
  catalog,
  currency,
  onSave,
  saving,
}) {
  const [date, setDate] = useState(invoice?.date || today());
  const [shopId, setShopId] = useState(invoice?.shopId || "");
  const [selectedCurrency, setCurrency] = useState(
    invoice?.currency || currency,
  );
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [lines, setLines] = useState(
    invoice?.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      unitPrice:
        l.unitPriceCents === null ? "" : (l.unitPriceCents / 100).toFixed(2),
    })) || [{ itemId: "", quantity: 1, unitPrice: "" }],
  );
  const change = (index, key, value) =>
    setLines(
      lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    );
  const total = lines.reduce(
    (sum, line) =>
      sum +
      lineTotal(
        Number(line.quantity),
        Math.round(Number(line.unitPrice) * 100),
      ),
    0,
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          date,
          shopId: Number(shopId),
          currency: selectedCurrency,
          notes,
          lines: lines.map((l) => ({
            ...l,
            itemId: Number(l.itemId),
            quantity: Number(l.quantity),
          })),
        });
      }}
    >
      {(!catalog.shops.length || !catalog.items.length) && (
        <p className="notice">
          Add a shop and an item in Shops & items before recording an expense.
          Ask your administrator if you cannot manage the catalog.
        </p>
      )}
      <div className="form-grid">
        <label>
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Shop
          <select
            aria-label="Shop"
            required
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
          >
            <option value="">Choose a shop</option>
            {catalog.shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Expense currency
          <select
            aria-label="Expense currency"
            value={selectedCurrency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="section-label">
        ITEMS PURCHASED <span>Quantity × unit price</span>
      </div>
      <div className="line-items">
        {lines.map((line, index) => (
          <div className="line-item" key={index}>
            <label>
              Item {index + 1}
              <select
                aria-label={`Item ${index + 1}`}
                required
                value={line.itemId}
                onChange={(e) => change(index, "itemId", e.target.value)}
              >
                <option value="">Choose an item</option>
                {catalog.items.map((item) => {
                  const manufacturer = catalog.manufacturers?.find(
                    (entry) => entry.id === item.manufacturerId,
                  );
                  return (
                    <option key={item.id} value={item.id}>
                      {manufacturer
                        ? `${item.name} (${manufacturer.name})`
                        : item.name}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Quantity {index + 1}
              <input
                type="number"
                min="0.001"
                max="1000"
                step="0.001"
                required
                value={line.quantity}
                onChange={(e) => change(index, "quantity", e.target.value)}
              />
            </label>
            <label>
              Unit price {index + 1}
              <input
                type="number"
                min="0"
                max="9999999.99"
                step="0.01"
                required
                value={line.unitPrice}
                onChange={(e) => change(index, "unitPrice", e.target.value)}
              />
            </label>
            <button
              type="button"
              className="icon-button"
              disabled={lines.length === 1}
              aria-label={`Remove line ${index + 1}`}
              onClick={() => setLines(lines.filter((_, i) => i !== index))}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="text-button"
        type="button"
        disabled={lines.length >= 100}
        onClick={() =>
          setLines([...lines, { itemId: "", quantity: 1, unitPrice: "" }])
        }
      >
        <Plus size={16} />
        Add line
      </button>
      <label className="notes-field">
        Notes
        <textarea
          maxLength={2000}
          rows={2}
          placeholder="What was this expense for? (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <footer className="form-footer">
        <div>
          <span className="eyebrow">EXPENSE TOTAL</span>
          <strong>{money(total, selectedCurrency)}</strong>
        </div>
        <button
          className="button primary"
          disabled={saving || !catalog.shops.length || !catalog.items.length}
        >
          {saving ? "Saving…" : "Save expense"}
        </button>
      </footer>
    </form>
  );
}
