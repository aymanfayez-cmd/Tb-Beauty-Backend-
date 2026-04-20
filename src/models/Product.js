const mongoose = require('mongoose');

function toSlug(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    description: { type: String, default: '' },
    category: { type: String, required: true, trim: true, index: true },
    brand: { type: String, required: true, trim: true, index: true },
    price: { type: Number, required: true, min: 0 },
    isOffer: { type: Boolean, default: false, index: true },
    isNewArrival: { type: Boolean, default: false, index: true },
    offerLabel: { type: String, default: 'SALE', trim: true },
    offerPercent: { type: Number, min: 0, max: 100 },
    /** Fixed QAR off per unit; if set (>0), used instead of offerPercent. */
    offerDiscountQar: { type: Number, min: 0 },
    offerStart: { type: Date },
    offerEnd: { type: Date },
    images: { type: [String], default: [] },
    stock: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

// Auto-generate slug from name when missing
productSchema.pre('validate', function (next) {
  if ((!this.slug || this.slug.length === 0) && this.name) {
    this.slug = toSlug(this.name);
  }
  next();
});

// Speed up storefront list + price filters (shop always sends a price range).
productSchema.index({ createdAt: -1 });
productSchema.index({ price: 1, createdAt: -1 });
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ brand: 1, createdAt: -1 });
productSchema.index({ isOffer: 1, createdAt: -1 });
productSchema.index({ isNewArrival: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);

