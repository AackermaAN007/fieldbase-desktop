export function calcInvoiceTotals(items = [], taxRate = 0, discountPct = 0) {
  const safeItems = Array.isArray(items) ? items : []
  const laborSub = safeItems.filter(i => i.category === 'Labor').reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
  const materialsSub = safeItems.filter(i => i.category === 'Materials').reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
  const subtotal = laborSub + materialsSub
  const discount = subtotal * ((Number(discountPct) || 0) / 100)
  const taxable = subtotal - discount
  const tax = taxable * ((Number(taxRate) || 0) / 100)
  const total = taxable + tax
  return { laborSub, materialsSub, subtotal, discount, tax, total }
}

// symbol defaults to $ but accepts settings.currency_symbol
export function fmt(n, symbol = '$') {
  const num = Number.isFinite(Number(n)) ? Number(n) : 0
  return symbol + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
