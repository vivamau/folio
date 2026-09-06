const { readInvoices } = require("../backend/ledger");
const { createSnapshotService } = require("../backend/snapshots");
test("ledger maps legacy rows with missing catalog references without inventing prices", async () => {
  const db = {
    all: jest
      .fn()
      .mockResolvedValueOnce([
        {
          ID: 1,
          invoice_date: 1785542400,
          shop_id: 1,
          invoice_currency: "KES",
          invoice_notes: "",
        },
        { ID: 2, invoice_date: 1785542400, invoice_currency: "EUR" },
      ])
      .mockResolvedValueOnce([
        { invoice_id: 1, item_id: 1, unit_price_cents: null },
        {
          invoice_id: 1,
          item_id: 2,
          iteminvoice_nr: 3,
          unit_price_cents: null,
        },
      ]),
  };
  const entries = await readInvoices(db, 5);
  expect(entries[0]).toMatchObject({
    shop: "Unknown shop",
    totalCents: null,
    unpriced: true,
  });
  expect(entries[0].lines[0]).toMatchObject({
    name: "Unknown item",
    category: "Uncategorized",
    quantity: 1,
  });
  expect(entries[0].lines[1].quantity).toBe(3);
  expect(entries[1].unpriced).toBe(true);
});
test("snapshot jobs propagate storage errors and permit a later retry", async () => {
  const db = {
    transaction: jest.fn().mockRejectedValue(new Error("Storage unavailable")),
  };
  const service = createSnapshotService(db);
  await expect(service.run()).rejects.toThrow("Storage unavailable");
  await expect(service.run()).rejects.toThrow("Storage unavailable");
  expect(db.transaction).toHaveBeenCalledTimes(2);
});
