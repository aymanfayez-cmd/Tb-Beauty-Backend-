const router = require('express').Router();

const authRequired = require('../middlewares/authRequired');
const { register, login, me } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authRequired, me);

module.exports = router;
