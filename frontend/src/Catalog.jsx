import React, { useState } from "react";
import { Plus, Store, Package, Tag, Factory } from "lucide-react";
export const catalogKinds = {
  shop: "shops",
  item: "items",
  category: "categories",
  manufacturer: "manufacturers",
};
export function CatalogForm({ kind, catalog, onSave, saving }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [categoryId, setCategory] = useState("");
  const [manufacturerId, setManufacturer] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name,
          address,
          categoryId: categoryId ? Number(categoryId) : null,
          manufacturerId: manufacturerId ? Number(manufacturerId) : null,
        });
      }}
    >
      <label>
        Name
        <input
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {kind === "shop" && (
        <label>
          Address
          <input
            maxLength={500}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
      )}
      {kind === "item" && (
        <div className="form-grid">
          <label>
            Category
            <select
              aria-label="Category"
              value={categoryId}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {catalog.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Manufacturer
            <select
              aria-label="Manufacturer"
              value={manufacturerId}
              onChange={(e) => setManufacturer(e.target.value)}
            >
              <option value="">Not specified</option>
              {catalog.manufacturers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <footer className="form-footer">
        <span>Keep your records organized.</span>
        <button className="button primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </footer>
    </form>
  );
}
export default function Catalog({ catalog, canManage, onAdd }) {
  const icons = {
    shop: Store,
    item: Package,
    category: Tag,
    manufacturer: Factory,
  };
  return (
    <div className="catalog-grid">
      {Object.entries(catalogKinds).map(([kind, key]) => {
        const Icon = icons[kind];
        return (
          <section className="panel" key={key}>
            <div className="panel-heading">
              <h2>
                <Icon size={20} />
                {key === "categories"
                  ? "Categories"
                  : key[0].toUpperCase() + key.slice(1)}
              </h2>
              <span className="count-badge">{catalog[key].length}</span>
            </div>
            <div className="catalog-list">
              {catalog[key].length ? (
                catalog[key].map((entry) => (
                  <div className="catalog-entry" key={entry.id}>
                    <span>
                      {entry.name}
                      {entry.address && <small>{entry.address}</small>}
                    </span>
                    <span className="record-number">
                      #{String(entry.id).padStart(3, "0")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted">
                  No {key} yet. Start with the places and things you buy most.
                </p>
              )}
            </div>
            {canManage && (
              <button className="text-button" onClick={() => onAdd(kind)}>
                <Plus size={16} />
                Add {kind}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
