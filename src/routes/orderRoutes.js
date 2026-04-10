const router = require('express').Router();
const adminOnly = require('../middlewares/adminOnly');
const authRequired = require('../middlewares/authRequired');
const orderController = require('../controllers/orderController');

router.get('/mine', authRequired, orderController.listMyOrders);
router.get('/', adminOnly, orderController.listOrders);
router.get('/:id', adminOnly, orderController.getOrderById);

module.exports = router;
