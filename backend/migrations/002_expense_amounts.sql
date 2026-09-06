-- Applied once via SchemaMigrations. Money is stored as integer minor units.
ALTER TABLE Invoices ADD COLUMN invoice_currency TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE Invoices ADD COLUMN invoice_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE ItemsInvoices ADD COLUMN unit_price_cents INTEGER CHECK(unit_price_cents >= 0);
ALTER TABLE ItemsInvoices ADD COLUMN quantity REAL CHECK(quantity > 0);
CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON Invoices(user_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_lines ON ItemsInvoices(invoice_id);
