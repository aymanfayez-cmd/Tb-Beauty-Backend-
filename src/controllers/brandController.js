const Brand = require('../models/Brand');

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePageLimit(req, defaultLimit) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const limit = Math.min(3000, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : defaultLimit));
  return { page, limit };
}

exports.listBrands = async (req, res, next) => {
  try {
    const { page, limit } = parsePageLimit(req, 40);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter = q ? { name: new RegExp(escapeRegex(q), 'i') } : {};
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      Brand.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Brand.countDocuments(filter)
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));
    const brands = rows.map((b) => ({ _id: b._id, name: b.name }));

    return res.status(200).json({
      brands,
      pagination: { page, pages, total, limit }
    });
  } catch (err) {
    return next(err);
  }
};

exports.createBrand = async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      return res.status(400).json({ message: 'name is required' });
    }
    const brand = await Brand.create({ name: trimmed });
    return res.status(201).json({ brand: { _id: brand._id, name: brand.name } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Brand already exists' });
    }
    return next(err);
  }
};

exports.importBrands = async (req, res, next) => {
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
        await Brand.create({ name });
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

exports.deleteBrand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const brand = await Brand.findByIdAndDelete(id);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    return res.status(200).json({ message: 'Brand deleted' });
  } catch (err) {
    return next(err);
  }
};
