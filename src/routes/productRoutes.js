const router = require('express').Router();

const adminOnly = require('../middlewares/adminOnly');
const { cacheControl } = require('../middlewares/cacheControl');
const {
  getProducts,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

// GET all products (optional filters: category, brand, price or minPrice/maxPrice)
router.get('/', cacheControl(30), getProducts);
router.get('/slug/:slug', cacheControl(60), getProductBySlug);
/** Checkout / cart price sync — must be after /slug/:slug */
router.get('/:id', cacheControl(10), getProductById);

// Admin operations
router.post('/', adminOnly, createProduct);
router.put('/:id', adminOnly, updateProduct);
router.delete('/:id', adminOnly, deleteProduct);

module.exports = router;

