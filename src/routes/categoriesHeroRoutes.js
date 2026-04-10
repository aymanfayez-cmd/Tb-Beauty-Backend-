const router = require('express').Router();

const adminOnly = require('../middlewares/adminOnly');
const {
  getCategoriesHeroSettings,
  updateCategoriesHeroSettings
} = require('../controllers/categoriesHeroController');

router.get('/', getCategoriesHeroSettings);
router.put('/', adminOnly, updateCategoriesHeroSettings);

module.exports = router;
