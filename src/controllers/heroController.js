const HeroSettings = require('../models/HeroSettings');

const MAX_SLIDES = 5;
const DEFAULT_SETTINGS = {
  key: 'home-hero',
  imageUrl: '/hero-main.jpg',
  title: 'Glow Like Never Before',
  subtitle: 'Premium Beauty Products',
  shopButtonText: 'Shop Now',
  exploreButtonText: 'Explore',
  buttonColor: '#FF4D8D',
  slides: [
    {
      imageUrl: '/hero-main.jpg',
      title: 'Glow Like Never Before',
      subtitle: 'Premium Beauty Products',
      linkHref: '/shop',
      shopButtonText: 'Shop Now',
      buttonColor: '#FF4D8D',
      order: 0,
      isActive: true
    }
  ]
};

function legacySlideFromHero(hero) {
  return {
    imageUrl: typeof hero?.imageUrl === 'string' ? hero.imageUrl : DEFAULT_SETTINGS.imageUrl,
    title: typeof hero?.title === 'string' ? hero.title : DEFAULT_SETTINGS.title,
    subtitle: typeof hero?.subtitle === 'string' ? hero.subtitle : DEFAULT_SETTINGS.subtitle,
    linkHref: typeof hero?.linkHref === 'string' && hero.linkHref.trim() ? hero.linkHref.trim() : '/shop',
    shopButtonText: typeof hero?.shopButtonText === 'string' ? hero.shopButtonText : DEFAULT_SETTINGS.shopButtonText,
    buttonColor: typeof hero?.buttonColor === 'string' && hero.buttonColor ? hero.buttonColor : DEFAULT_SETTINGS.buttonColor,
    order: 0,
    isActive: true
  };
}

function normalizeSlides(rawSlides, fallbackHero) {
  if (!Array.isArray(rawSlides)) return [legacySlideFromHero(fallbackHero)];

  const normalized = rawSlides
    .slice(0, MAX_SLIDES)
    .map((slide, idx) => ({
      imageUrl: typeof slide?.imageUrl === 'string' ? slide.imageUrl : '',
      title: typeof slide?.title === 'string' ? slide.title : '',
      subtitle: typeof slide?.subtitle === 'string' ? slide.subtitle : '',
      linkHref: typeof slide?.linkHref === 'string' && slide.linkHref.trim() ? slide.linkHref.trim() : '/shop',
      shopButtonText: typeof slide?.shopButtonText === 'string' ? slide.shopButtonText : '',
      buttonColor: typeof slide?.buttonColor === 'string' && slide.buttonColor ? slide.buttonColor : '#FF4D8D',
      order: typeof slide?.order === 'number' ? slide.order : idx,
      isActive: typeof slide?.isActive === 'boolean' ? slide.isActive : true
    }))
    .filter((slide) => slide.isActive !== false);

  if (normalized.length > 0) return normalized;
  return [legacySlideFromHero(fallbackHero)];
}

function syncLegacyFromSlides(slides) {
  const first = Array.isArray(slides) && slides.length > 0 ? slides[0] : DEFAULT_SETTINGS.slides[0];
  return {
    imageUrl: first.imageUrl ?? '',
    title: first.title ?? '',
    subtitle: first.subtitle ?? '',
    shopButtonText: first.shopButtonText ?? '',
    buttonColor: first.buttonColor ?? '#FF4D8D'
  };
}

async function getOrCreateHero() {
  let hero = await HeroSettings.findOne({ key: 'home-hero' });
  if (!hero) hero = await HeroSettings.create(DEFAULT_SETTINGS);
  if (!Array.isArray(hero.slides) || hero.slides.length === 0) {
    hero.slides = [legacySlideFromHero(hero)];
    await hero.save();
  }
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
    const current = await getOrCreateHero();
    const updates = {};

    if (payload.slides !== undefined) {
      const slides = normalizeSlides(payload.slides, current);
      Object.assign(updates, syncLegacyFromSlides(slides));
      updates.slides = slides;
    }

    const legacyUpdates = {
      imageUrl: payload.imageUrl,
      title: payload.title,
      subtitle: payload.subtitle,
      shopButtonText: payload.shopButtonText,
      exploreButtonText: payload.exploreButtonText,
      buttonColor: payload.buttonColor
    };

    Object.keys(legacyUpdates).forEach((k) => {
      if (legacyUpdates[k] === undefined) delete legacyUpdates[k];
    });
    Object.assign(updates, legacyUpdates);

    if (Object.keys(legacyUpdates).length > 0 && updates.slides === undefined) {
      const currentSlides = normalizeSlides(current.slides, current);
      const mergedFirst = { ...currentSlides[0], ...legacyUpdates };
      updates.slides = [{ ...mergedFirst, order: 0, isActive: true }, ...currentSlides.slice(1)];
    }

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
