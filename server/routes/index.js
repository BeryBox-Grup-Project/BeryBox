const express = require('express');
const rateLimit = require('express-rate-limit');
const AuthController = require('../controllers/authController');
const ImageController = require('../controllers/imageController');
const ItemController = require('../controllers/itemController');
const authentication = require('../middlewares/authentication');
const { itemOwnerAuthorization } = require('../middlewares/authorization');

const router = express.Router();
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res, next) {
    const error = new Error('Too many requests');
    error.status = 429;
    next(error);
  },
});

router.post('/register', AuthController.register);
router.post('/login', loginRateLimiter, AuthController.login);
router.get('/me', authentication, AuthController.me);
router.get('/images/auth', authentication, ImageController.authenticationParameters);

router.get('/items', authentication, ItemController.list);
router.get('/items/mine', authentication, ItemController.mine);
router.get('/items/:id', authentication, ItemController.detail);
router.post('/items', authentication, ItemController.create);
router.patch('/items/:id', authentication, itemOwnerAuthorization, ItemController.update);
router.delete('/items/:id', authentication, itemOwnerAuthorization, ItemController.cancel);

module.exports = router;
