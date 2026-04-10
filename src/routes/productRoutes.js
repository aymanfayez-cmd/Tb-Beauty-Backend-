const router = require('express').Router();

const adminOnly = require('../middlewares/adminOnly');
const { cacheControl } = require('../middlewares/cacheControl');
const {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

// GET all products (optional filters: category, brand, price or minPrice/maxPrice)
router.get('/', cacheControl(30), getProducts);
router.get('/slug/:slug', cacheControl(60), getProductBySlug);

// Admin operations
router.post('/', adminOnly, createProduct);
router.put('/:id', adminOnly, updateProduct);
router.delete('/:id', adminOnly, deleteProduct);

module.exports = router;

