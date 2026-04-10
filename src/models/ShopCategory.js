const mongoose = require('mongoose');

const shopCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

shopCategorySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('ShopCategory', shopCategorySchema);
