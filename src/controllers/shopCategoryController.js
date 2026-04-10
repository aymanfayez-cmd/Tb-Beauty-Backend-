const ShopCategory = require('../models/ShopCategory');

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.listShopCategories = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 100));
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter = q ? { name: new RegExp(escapeRegex(q), 'i') } : {};
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      ShopCategory.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      ShopCategory.countDocuments(filter)
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));
    const categories = rows.map((c) => ({ _id: c._id, name: c.name }));

    return res.status(200).json({
      categories,
      pagination: { page, pages, total, limit }
    });
  } catch (err) {
    return next(err);
  }
};

exports.createShopCategory = async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      return res.status(400).json({ message: 'name is required' });
    }
    const category = await ShopCategory.create({ name: trimmed });
    return res.status(201).json({ category: { _id: category._id, name: category.name } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Category already exists' });
    }
    return next(err);
  }
};

exports.importShopCategories = async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'text is required' });
    }
    const lines = [...new Set(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
    let upserted = 0;
    let matched = 0;
    for (const name of lines) {
      try {
        await ShopCategory.create({ name });
        upserted++;
      } catch (e) {
        if (e.code === 11000) matched++;
        else throw e;
      }
    }
    return res.status(200).json({ upserted, matched, requested: lines.length });
  } catch (err) {
    return next(err);
  }
};

exports.deleteShopCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await ShopCategory.findByIdAndDelete(id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    return res.status(200).json({ message: 'Category deleted' });
  } catch (err) {
    return next(err);
  }
};
