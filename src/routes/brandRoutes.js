const router = require('express').Router();
const adminOnly = require('../middlewares/adminOnly');
const {
  listBrands,
  createBrand,
  importBrands,
  deleteBrand
} = require('../controllers/brandController');

router.get('/', listBrands);
router.post('/', adminOnly, createBrand);
router.post('/import', adminOnly, importBrands);
router.delete('/:id', adminOnly, deleteBrand);

module.exports = router;
