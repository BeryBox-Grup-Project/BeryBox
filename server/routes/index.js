const express = require('express');
const rateLimit = require('express-rate-limit');
const AuthController = require('../controllers/authController');
const ImageController = require('../controllers/imageController');
const ItemController = require('../controllers/itemController');
const RequestController = require('../controllers/requestController');
const ConversationController = require('../controllers/conversationController');
const MessageController = require('../controllers/messageController');
const OrganizationController = require('../controllers/organizationController');
const AdminController = require('../controllers/adminController');
const authentication = require('../middlewares/authentication');
const {
  itemOwnerAuthorization,
  conversationParticipantAuthorization,
  organizationAuthorization,
  adminAuthorization,
} = require('../middlewares/authorization');

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
const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return String(req.user.id);
  },
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

router.post('/requests', authentication, RequestController.create);
router.get('/requests/incoming', authentication, RequestController.incoming);
router.get('/requests/outgoing', authentication, RequestController.outgoing);
router.patch('/requests/:id', authentication, RequestController.update);
router.post('/requests/:id/redeem-credit', authentication, RequestController.redeemCredit);

router.post('/conversations', authentication, ConversationController.create);
router.get('/conversations', authentication, ConversationController.inbox);
router.get(
  '/conversations/:id/messages',
  authentication,
  conversationParticipantAuthorization,
  MessageController.history,
);
router.post(
  '/conversations/:id/messages',
  authentication,
  messageRateLimiter,
  conversationParticipantAuthorization,
  MessageController.create,
);

router.get('/organizations', authentication, OrganizationController.list);
router.get('/organizations/:id', authentication, OrganizationController.detail);
router.post(
  '/organizations',
  authentication,
  organizationAuthorization,
  OrganizationController.create,
);

router.get(
  '/admin/organizations',
  authentication,
  adminAuthorization,
  AdminController.organizations,
);
router.patch(
  '/admin/organizations/:id',
  authentication,
  adminAuthorization,
  AdminController.verifyOrganization,
);
router.get('/admin/reports', authentication, adminAuthorization, AdminController.reports);
router.patch(
  '/admin/reports/:id',
  authentication,
  adminAuthorization,
  AdminController.resolveReport,
);

module.exports = router;
