const RewardSettings = require('../models/RewardSettings');

function normalizePayload(body = {}) {
  const enabled = body.enabled === true || body.enabled === 'true';
  const pointsPerCurrency = Math.max(0, Number(body.pointsPerCurrency) || 0);
  const pointsRequired = Math.max(1, Math.floor(Number(body.pointsRequired) || 100));
  const discountValue = Math.max(0, Number(body.discountValue) || 0);
  return { enabled, pointsPerCurrency, pointsRequired, discountValue };
}

async function getOrCreateSettings() {
  let doc = await RewardSettings.findOne({ key: 'global' });
  if (!doc) {
    doc = await RewardSettings.create({
      key: 'global',
      enabled: false,
      pointsPerCurrency: 0,
      pointsRequired: 100,
      discountValue: 10
    });
  }
  let changed = false;
  if (doc.pointsPerCurrency === undefined || doc.pointsPerCurrency === null) {
    doc.pointsPerCurrency = 0;
    changed = true;
  }
  if (doc.pointsRequired === undefined || doc.pointsRequired === null) {
    doc.pointsRequired = 100;
    changed = true;
  }
  if (doc.discountValue === undefined || doc.discountValue === null) {
    doc.discountValue = 10;
    changed = true;
  }
  if (changed) await doc.save();
  return doc;
}

exports.getRewardSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    return res.status(200).json({ settings });
  } catch (err) {
    return next(err);
  }
};

exports.updateRewardSettings = async (req, res, next) => {
  try {
    const updates = normalizePayload(req.body);
    const settings = await RewardSettings.findOneAndUpdate(
      { key: 'global' },
      updates,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({ settings });
  } catch (err) {
    return next(err);
  }
};
