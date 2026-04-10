const router = require('express').Router();

const adminOnly = require('../middlewares/adminOnly');
const { cacheControl } = require('../middlewares/cacheControl');
const { getHeroSettings, updateHeroSettings } = require('../controllers/heroController');

// Public read for storefront
router.get('/', cacheControl(60), getHeroSettings);

// Admin write for dashboard
router.put('/', adminOnly, updateHeroSettings);

module.exports = router;
