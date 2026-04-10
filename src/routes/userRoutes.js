const router = require('express').Router();

const adminOnly = require('../middlewares/adminOnly');
const { createUser, listUsers } = require('../controllers/userController');

router.get('/', adminOnly, listUsers);
router.post('/', adminOnly, createUser);

module.exports = router;

