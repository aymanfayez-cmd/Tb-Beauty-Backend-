const CategoriesHeroSettings = require('../models/CategoriesHeroSettings');

const DEFAULT_SETTINGS = {
  key: 'categories-hero',
  imageUrl: '/hero-main.jpg',
  title: 'Shop by Category',
  subtitle: 'Explore Our Collections'
};

async function getOrCreateCategoriesHero() {
  let hero = await CategoriesHeroSettings.findOne({ key: 'categories-hero' });
  if (!hero) hero = await CategoriesHeroSettings.create(DEFAULT_SETTINGS);
  return hero;
}

exports.getCategoriesHeroSettings = async (req, res, next) => {
  try {
    const hero = await getOrCreateCategoriesHero();
    return res.status(200).json({ hero });
  } catch (err) {
    return next(err);
  }
};

exports.updateCategoriesHeroSettings = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const updates = {
      imageUrl: payload.imageUrl,
      title: payload.title,
      subtitle: payload.subtitle
    };

    Object.keys(updates).forEach((k) => {
      if (updates[k] === undefined) delete updates[k];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'At least one field is required' });
    }

    const hero = await CategoriesHeroSettings.findOneAndUpdate(
      { key: 'categories-hero' },
      { $set: updates, $setOnInsert: { key: 'categories-hero' } },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({ hero, message: 'Categories hero updated' });
  } catch (err) {
    return next(err);
  }
};
