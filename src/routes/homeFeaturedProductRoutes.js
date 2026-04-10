const router = require('express').Router();

const adminOnly = require('../middlewares/adminOnly');
const { cacheControl } = require('../middlewares/cacheControl');
const {
  getHomeFeaturedProducts,
  createHomeFeaturedProduct,
  deleteHomeFeaturedProduct
} = require('../controllers/homeFeaturedProductController');

router.get('/', cacheControl(60), getHomeFeaturedProducts);
router.post('/', adminOnly, createHomeFeaturedProduct);
router.delete('/:id', adminOnly, deleteHomeFeaturedProduct);

module.exports = router;
