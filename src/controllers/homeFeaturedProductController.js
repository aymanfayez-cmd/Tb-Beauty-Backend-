const HomeFeaturedProduct = require('../models/HomeFeaturedProduct');

const defaults = [
  { name: 'Radiant Glow Serum', price: 29.99, imageUrl: '/hero-main.jpg' },
  { name: 'Luxury Lipstick', price: 19.99, imageUrl: '/hero-main.jpg' },
  { name: 'Hydrating Face Cream', price: 24.99, imageUrl: '/hero-main.jpg' },
  { name: 'Elegant Perfume', price: 49.99, imageUrl: '/hero-main.jpg' }
];

async function seedIfEmpty() {
  const count = await HomeFeaturedProduct.countDocuments();
  if (count === 0) await HomeFeaturedProduct.insertMany(defaults);
}

exports.getHomeFeaturedProducts = async (req, res, next) => {
  try {
    await seedIfEmpty();
    const products = await HomeFeaturedProduct.find().sort({ createdAt: 1 }).lean();
    return res.status(200).json({ products });
  } catch (err) {
    return next(err);
  }
};

exports.createHomeFeaturedProduct = async (req, res, next) => {
  try {
    const { name, price, imageUrl } = req.body || {};
    if (!name || price === undefined || !imageUrl) {
      return res.status(400).json({ message: 'name, price and imageUrl are required' });
    }
    const product = await HomeFeaturedProduct.create({
      name: String(name).trim(),
      price: Number(price),
      imageUrl
    });
    return res.status(201).json({ product });
  } catch (err) {
    return next(err);
  }
};

exports.deleteHomeFeaturedProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await HomeFeaturedProduct.findByIdAndDelete(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.status(200).json({ message: 'Featured product deleted' });
  } catch (err) {
    return next(err);
  }
};
