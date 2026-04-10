const Product = require('../models/Product');

function toNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function toBool(val) {
  if (val === true || val === false) return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return undefined;
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.getProducts = async (req, res, next) => {
  try {
    const {
      category,
      brand,
      price,
      minPrice,
      maxPrice,
      isOffer,
      skinType,
      rating,
      inStock,
      page,
      limit,
      search,
      q
    } = req.query;

    const filter = {};
    const andClauses = [];

    const searchRaw = typeof search === 'string' ? search : typeof q === 'string' ? q : '';
    const searchTrim = searchRaw.trim();
    if (searchTrim) {
      const safe = escapeRegex(searchTrim);
      const rx = new RegExp(safe, 'i');
      andClauses.push({
        $or: [{ name: rx }, { description: rx }, { brand: rx }, { category: rx }]
      });
    }

    if (typeof category === 'string' && category.trim()) {
      filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
    }
    if (typeof brand === 'string' && brand.trim()) {
      filter.brand = new RegExp(`^${escapeRegex(brand.trim())}$`, 'i');
    }
    if (typeof skinType === 'string' && skinType.trim()) {
      filter.skinType = new RegExp(`^${escapeRegex(skinType.trim())}$`, 'i');
    }

    const minRating = toNumber(rating);
    if (minRating !== undefined && minRating > 0) {
      filter.rating = { $gte: minRating };
    }

    const stockBool = toBool(inStock);
    if (stockBool === true) filter.stock = { $gt: 0 };
    if (stockBool === false) filter.stock = 0;

    if (isOffer === 'true') {
      const now = new Date();
      filter.isOffer = true;
      andClauses.push(
        { $or: [{ offerStart: { $exists: false } }, { offerStart: null }, { offerStart: { $lte: now } }] },
        { $or: [{ offerEnd: { $exists: false } }, { offerEnd: null }, { offerEnd: { $gte: now } }] }
      );
    } else if (isOffer === 'false') {
      filter.isOffer = false;
    }

    if (andClauses.length) {
      filter.$and = [...(filter.$and || []), ...andClauses];
    }

    const exactPrice = toNumber(price);
    const minP = toNumber(minPrice);
    const maxP = toNumber(maxPrice);

    if (exactPrice !== undefined) {
      filter.price = exactPrice;
    } else if (minP !== undefined || maxP !== undefined) {
      filter.price = {};
      if (minP !== undefined) filter.price.$gte = minP;
      if (maxP !== undefined) filter.price.$lte = maxP;
    }

    const pageNum = Math.max(1, toNumber(page) || 1);
    const limitNum = Math.min(60, Math.max(1, toNumber(limit) || 12));
    const skip = (pageNum - 1) * limitNum;

    // Storefront list view: keep response small & fast.
    const LIST_FIELDS =
      'name slug price images category brand skinType rating stock isOffer offerLabel offerPercent offerStart offerEnd createdAt';

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select(LIST_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter)
    ]);

    return res.status(200).json({
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.max(1, Math.ceil(total / limitNum))
      }
    });
  } catch (err) {
    return next(err);
  }
};

exports.getProductBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const product = await Product.findOne({ slug });

    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      return next(err);
    }

    return res.status(200).json({ product });
  } catch (err) {
    return next(err);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const { name, slug, description, category, brand, price, images, stock, skinType, rating, isOffer, offerLabel, offerPercent, offerStart, offerEnd } = req.body;

    if (!name || !category || !brand || price === undefined) {
      return res.status(400).json({ message: 'name, category, brand, and price are required' });
    }

    const product = await Product.create({
      name,
      slug,
      description,
      category,
      brand,
      price,
      skinType,
      rating,
      isOffer,
      offerLabel,
      offerPercent,
      offerStart,
      offerEnd,
      images,
      stock
    });

    return res.status(201).json({ product });
  } catch (err) {
    return next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent accidental update of _id
    if (updates && Object.prototype.hasOwnProperty.call(updates, '_id')) {
      delete updates._id;
    }

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      return next(err);
    }

    return res.status(200).json({ product });
  } catch (err) {
    return next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      return next(err);
    }

    return res.status(200).json({ message: 'Product deleted' });
  } catch (err) {
    return next(err);
  }
};
