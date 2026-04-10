const router = require('express').Router();
const authRequired = require('../middlewares/authRequired');
const paymentController = require('../controllers/paymentController');

router.post('/paytabs', authRequired, paymentController.createPayment);
router.post('/cod', authRequired, paymentController.createCodOrder);
router.get('/rewards/summary', authRequired, paymentController.getRewardsSummary);
router.post('/rewards/preview', authRequired, paymentController.previewRewards);
router.post('/lookup-order', paymentController.lookupOrderForCustomer);
router.post('/callback', paymentController.paytabsCallback);
router.get('/order/:cartId', paymentController.getOrderByCartId);

module.exports = router;
