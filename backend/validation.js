const { z } = require("zod");
const currencies = ["EUR", "USD", "KES", "GBP", "CHF", "CAD", "AUD"];
const id = z.number().int().positive();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid calendar date");
const invoiceSchema = z.object({
  date,
  shopId: id,
  currency: z.enum(currencies),
  notes: z.string().trim().max(2000).default(""),
  lines: z
    .array(
      z.object({
        itemId: id,
        quantity: z.number().positive().max(1000).multipleOf(0.001),
        unitPrice: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/),
      }),
    )
    .min(1)
    .max(100),
});
const catalogSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).default(""),
  categoryId: id.nullish(),
  manufacturerId: id.nullish(),
});
const filterSchema = z
  .object({
    search: z.string().max(200).default(""),
    from: date.optional(),
    to: date.optional(),
    currency: z.enum(currencies).optional(),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Start date must be before end date",
  );
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error(result.error.issues[0].message);
    error.status = 400;
    throw error;
  }
  return result.data;
}
const summarySchema = z
  .object({
    title: z.string().trim().max(120).default(""),
    from: date,
    to: date,
  })
  .refine(
    (value) => value.from <= value.to,
    "Start date must be before end date",
  );
module.exports = {
  summarySchema,
  invoiceSchema,
  catalogSchema,
  filterSchema,
  parse,
  z,
  currencies,
};
