async function readInvoices(db, userId, filter = {}) {
  const clauses = ["v.user_id=?"];
  const params = [userId];
  if (filter.from) {
    clauses.push("v.invoice_date>=?");
    params.push(Date.parse(filter.from) / 1000);
  }
  if (filter.to) {
    clauses.push("v.invoice_date<?");
    params.push(Date.parse(filter.to) / 1000 + 86400);
  }
  if (filter.currency) {
    clauses.push("v.invoice_currency=?");
    params.push(filter.currency);
  }
  const invoices = await db.all(
    `SELECT v.*,s.shop_name FROM Invoices v LEFT JOIN Shops s ON s.ID=v.shop_id WHERE ${clauses.join(" AND ")} ORDER BY v.invoice_date DESC,v.ID DESC`,
    params,
  );
  const lines = await db.all(
    "SELECT l.*,i.item_name,t.itemtype_name FROM ItemsInvoices l JOIN Invoices v ON v.ID=l.invoice_id LEFT JOIN Items i ON i.ID=l.item_id LEFT JOIN ItemTypes t ON t.ID=i.itemtype_id WHERE v.user_id=?",
    [userId],
  );
  const results = invoices.map((v) => {
    const entries = lines
      .filter((l) => l.invoice_id === v.ID)
      .map((l) => ({
        itemId: l.item_id,
        name: l.item_name || "Unknown item",
        category: l.itemtype_name || "Uncategorized",
        quantity: l.quantity ?? l.iteminvoice_nr ?? 1,
        unitPriceCents: l.unit_price_cents,
      }));
    const unpriced =
      entries.length === 0 || entries.some((l) => l.unitPriceCents === null);
    return {
      id: v.ID,
      date: new Date(v.invoice_date * 1000).toISOString().slice(0, 10),
      shopId: v.shop_id,
      shop: v.shop_name || "Unknown shop",
      currency: v.invoice_currency,
      notes: v.invoice_notes,
      lines: entries,
      unpriced,
      totalCents: unpriced
        ? null
        : entries.reduce(
            (sum, l) =>
              sum +
              Math.round(
                (Math.round(l.quantity * 1000) * l.unitPriceCents) / 1000,
              ),
            0,
          ),
    };
  });
  const query = (filter.search || "").toLowerCase();
  return results.filter((v) =>
    [v.shop, v.notes, ...v.lines.map((l) => l.name)]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}
module.exports = { readInvoices };
