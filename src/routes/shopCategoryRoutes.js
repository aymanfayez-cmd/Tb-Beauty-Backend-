const router = require('express').Router();
const adminOnly = require('../middlewares/adminOnly');
const {
  listShopCategories,
  createShopCategory,
  importShopCategories,
  deleteShopCategory
} = require('../controllers/shopCategoryController');

router.get('/', listShopCategories);
router.post('/', adminOnly, createShopCategory);
router.post('/import', adminOnly, importShopCategories);
router.delete('/:id', adminOnly, deleteShopCategory);

module.exports = router;
