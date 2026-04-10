const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

brandSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Brand', brandSchema);
