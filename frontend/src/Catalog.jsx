import React, { useState } from "react";
import { Plus, Store, Package, Tag, Factory, Trash2 } from "lucide-react";
import ItemDashboard from "./ItemDashboard";
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
export default function Catalog({
  invoices = [],
  catalog,
  canManage,
  onAdd,
  onDeleteShop,
  onChangeCategory,
}) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedManufacturer, setSelectedManufacturer] = useState(null);
  if (selectedManufacturer)
    return (
      <ItemDashboard
        manufacturer={selectedManufacturer}
        items={catalog.items}
        invoices={invoices}
        onBack={() => setSelectedManufacturer(null)}
      />
    );
  if (selectedCategory)
    return (
      <ItemDashboard
        category={selectedCategory}
        items={catalog.items}
        invoices={invoices}
        onBack={() => setSelectedCategory(null)}
      />
    );
  if (selectedShop)
    return (
      <ItemDashboard
        shop={selectedShop}
        invoices={invoices}
        onBack={() => setSelectedShop(null)}
      />
    );
  if (selectedItem)
    return (
      <ItemDashboard
        item={selectedItem}
        invoices={invoices}
        onBack={() => setSelectedItem(null)}
      />
    );
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
                      <span>{entry.name}</span>
                      {kind === "item" && (
                        <span className="item-action-links">
                          <button
                            className="text-button item-trends-link"
                            aria-label={`View trends for ${entry.name}`}
                            onClick={() => setSelectedItem(entry)}
                          >
                            View trends
                          </button>
                          {canManage && (
                            <>
                              <span aria-hidden="true">|</span>
                              <button
                                className="text-button item-trends-link"
                                aria-label={`Change category for ${entry.name}`}
                                onClick={() => onChangeCategory(entry)}
                              >
                                Change category
                              </button>
                            </>
                          )}
                        </span>
                      )}
                      {kind === "shop" && (
                        <button
                          className="text-button item-trends-link"
                          aria-label={`View shop trends for ${entry.name}`}
                          onClick={() => setSelectedShop(entry)}
                        >
                          View trends
                        </button>
                      )}
                      {kind === "category" && (
                        <button
                          className="text-button item-trends-link"
                          aria-label={`View category trends for ${entry.name}`}
                          onClick={() => setSelectedCategory(entry)}
                        >
                          View trends
                        </button>
                      )}
                      {kind === "manufacturer" && (
                        <button
                          className="text-button item-trends-link"
                          aria-label={`View manufacturer trends for ${entry.name}`}
                          onClick={() => setSelectedManufacturer(entry)}
                        >
                          View trends
                        </button>
                      )}
                      {entry.address && <small>{entry.address}</small>}
                    </span>
                    <div className="row-actions">
                      <span className="record-number">
                        #{String(entry.id).padStart(3, "0")}
                      </span>
                      {kind === "shop" && canManage && (
                        <button
                          className="icon-button"
                          aria-label={`Delete shop ${entry.name}`}
                          title="Delete shop"
                          onClick={() => onDeleteShop(entry)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
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

export function ItemCategoryForm({ item, catalog, onSave, saving }) {
  const [categoryId, setCategoryId] = useState(item.categoryId ?? "");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ categoryId: categoryId === "" ? null : Number(categoryId) });
      }}
    >
      <p>
        Change the category for {item.name}. Existing expenses and live trends
        use the new category; saved summaries stay unchanged.
      </p>
      <label>
        Category
        <select
          aria-label="Category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Uncategorized</option>
          {catalog.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <footer className="form-footer">
        <button className="button primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </footer>
    </form>
  );
}
