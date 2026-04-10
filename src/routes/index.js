const router = require('express').Router();

const healthRoutes = require('./healthRoutes');
const userRoutes = require('./userRoutes');
const productRoutes = require('./productRoutes');
const heroRoutes = require('./heroRoutes');
const homeCategoryRoutes = require('./homeCategoryRoutes');
const homeFeaturedProductRoutes = require('./homeFeaturedProductRoutes');
const categoriesHeroRoutes = require('./categoriesHeroRoutes');
const brandRoutes = require('./brandRoutes');
const shopCategoryRoutes = require('./shopCategoryRoutes');
const paymentRoutes = require('./paymentRoutes');
const orderRoutes = require('./orderRoutes');
const authRoutes = require('./authRoutes');
const rewardSettingsRoutes = require('./rewardSettingsRoutes');

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/hero', heroRoutes);
router.use('/categories-hero', categoriesHeroRoutes);
router.use('/home-categories', homeCategoryRoutes);
router.use('/home-featured-products', homeFeaturedProductRoutes);
router.use('/brands', brandRoutes);
router.use('/shop-categories', shopCategoryRoutes);
router.use('/payment', paymentRoutes);
router.use('/orders', orderRoutes);
router.use('/reward-settings', rewardSettingsRoutes);

module.exports = router;

