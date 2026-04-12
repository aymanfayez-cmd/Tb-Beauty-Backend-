/**
 * Server-side unit price — must match storefront offer logic (ShopProductCard).
 * Discount = admin base `price` minus either fixed `offerDiscountQar` (if > 0) or `offerPercent`.
 */
function isOfferActive(product) {
  if (!product || !product.isOffer) return false;
  const flat = Number(product.offerDiscountQar);
  const pct = Number(product.offerPercent);
  const hasFlat = Number.isFinite(flat) && flat > 0;
  const hasPct = Number.isFinite(pct) && pct > 0;
  if (!hasFlat && !hasPct) return false;
  const now = new Date();
  if (product.offerStart && new Date(product.offerStart) > now) return false;
  if (product.offerEnd && new Date(product.offerEnd) < now) return false;
  return true;
}

function effectiveUnitPrice(product) {
  const base = Number(product?.price);
  if (!Number.isFinite(base) || base < 0) return 0;
  if (!isOfferActive(product)) return Math.round(base * 100) / 100;
  const flat = Number(product.offerDiscountQar);
  if (Number.isFinite(flat) && flat > 0) {
    return Math.round(Math.max(0, base - flat) * 100) / 100;
  }
  const pct = Number(product.offerPercent) || 0;
  const discounted = base - (base * pct) / 100;
  return Math.round(Math.max(0, discounted) * 100) / 100;
}

module.exports = { effectiveUnitPrice, isOfferActive };
