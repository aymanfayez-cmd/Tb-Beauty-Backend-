const HomeCategory = require('../models/HomeCategory');

exports.getHomeCategories = async (req, res, next) => {
  try {
    const categories = await HomeCategory.find().sort({ createdAt: 1 }).lean();
    return res.status(200).json({ categories });
  } catch (err) {
    return next(err);
  }
};

exports.createHomeCategory = async (req, res, next) => {
  try {
    const { title, imageUrl } = req.body || {};
    if (!title || !imageUrl) {
      return res.status(400).json({ message: 'title and imageUrl are required' });
    }
    const category = await HomeCategory.create({ title: String(title).trim(), imageUrl });
    return res.status(201).json({ category });
  } catch (err) {
    return next(err);
  }
};

exports.deleteHomeCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await HomeCategory.findByIdAndDelete(id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    return res.status(200).json({ message: 'Category deleted' });
  } catch (err) {
    return next(err);
  }
};
