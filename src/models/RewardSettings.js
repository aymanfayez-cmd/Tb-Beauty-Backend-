const mongoose = require('mongoose');

const rewardSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true, index: true },
    enabled: { type: Boolean, default: false },
    pointsPerCurrency: { type: Number, default: 0, min: 0 },
    pointsRequired: { type: Number, default: 100, min: 1 },
    discountValue: { type: Number, default: 10, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RewardSettings', rewardSettingsSchema);
