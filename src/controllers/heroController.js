const HeroSettings = require('../models/HeroSettings');

const DEFAULT_SETTINGS = {
  key: 'home-hero',
  imageUrl: '/hero-main.jpg',
  title: 'Glow Like Never Before',
  subtitle: 'Premium Beauty Products',
  shopButtonText: 'Shop Now',
  exploreButtonText: 'Explore',
  buttonColor: '#FF4D8D'
};

async function getOrCreateHero() {
  let hero = await HeroSettings.findOne({ key: 'home-hero' });
  if (!hero) hero = await HeroSettings.create(DEFAULT_SETTINGS);
  return hero;
}

exports.getHeroSettings = async (req, res, next) => {
  try {
    const hero = await getOrCreateHero();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json({ hero });
  } catch (err) {
    return next(err);
  }
};

exports.updateHeroSettings = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const updates = {
      imageUrl: payload.imageUrl,
      title: payload.title,
      subtitle: payload.subtitle,
      shopButtonText: payload.shopButtonText,
      exploreButtonText: payload.exploreButtonText,
      buttonColor: payload.buttonColor
    };

    Object.keys(updates).forEach((k) => {
      if (updates[k] === undefined) delete updates[k];
    });

    const hero = await HeroSettings.findOneAndUpdate(
      { key: 'home-hero' },
      { $set: updates, $setOnInsert: { key: 'home-hero' } },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({ hero, message: 'Hero section updated' });
  } catch (err) {
    return next(err);
  }
};
