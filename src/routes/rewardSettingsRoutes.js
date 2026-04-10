const router = require('express').Router();
const adminOnly = require('../middlewares/adminOnly');
const { getRewardSettings, updateRewardSettings } = require('../controllers/rewardSettingsController');

router.get('/', adminOnly, getRewardSettings);
router.put('/', adminOnly, updateRewardSettings);

module.exports = router;
