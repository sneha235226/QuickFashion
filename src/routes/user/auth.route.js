const { Router } = require('express');
const userAuthCtrl = require('../../controllers/user/auth.controller');

const router = Router();

router.post('/register', userAuthCtrl.register);
router.post('/login', userAuthCtrl.login);

module.exports = router;
