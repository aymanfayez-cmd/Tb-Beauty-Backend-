const router = require('express').Router();

const adminOnly = require('../middlewares/adminOnly');
const { cacheControl } = require('../middlewares/cacheControl');
const {
  getHomeCategories,
  createHomeCategory,
  deleteHomeCategory
} = require('../controllers/homeCategoryController');

router.get('/', cacheControl(60), getHomeCategories);
router.post('/', adminOnly, createHomeCategory);
router.delete('/:id', adminOnly, deleteHomeCategory);

module.exports = router;
