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
const ReviewController = require('../controllers/reviewController');
const ReportController = require('../controllers/reportController');
const AiController = require('../controllers/aiController');
const UserController = require('../controllers/userController');
const NotificationController = require('../controllers/notificationController');
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
router.post('/google-login', loginRateLimiter, AuthController.googleLogin);
router.get('/me', authentication, AuthController.me);
router.patch('/me', authentication, AuthController.updateMe);
router.get('/users/:id/reviews', authentication, ReviewController.listForUser);
router.get('/users/:id', authentication, UserController.detail);
router.get('/images/auth', authentication, ImageController.authenticationParameters);
router.post('/images/upload', authentication, ImageController.upload);

router.get('/items', authentication, ItemController.list);
router.get('/items/mine', authentication, ItemController.mine);
router.get('/items/:id', authentication, ItemController.detail);
router.post('/items', authentication, ItemController.create);
router.patch('/items/:id', authentication, itemOwnerAuthorization, ItemController.update);
router.post('/items/:id/complete', authentication, itemOwnerAuthorization, ItemController.complete);
router.delete('/items/:id', authentication, itemOwnerAuthorization, ItemController.cancel);

router.post('/requests', authentication, RequestController.create);
router.get('/requests/incoming', authentication, RequestController.incoming);
router.get('/requests/outgoing', authentication, RequestController.outgoing);
router.get('/history', authentication, RequestController.history);
router.patch('/requests/:id', authentication, RequestController.update);
router.post('/requests/:id/shipping', authentication, RequestController.setShipping);
router.post('/requests/:id/pay', authentication, RequestController.createPayment);
router.post('/requests/:id/pay/confirm', authentication, RequestController.confirmPayment);
router.patch('/requests/:id/tracking', authentication, RequestController.updateTracking);
router.post('/requests/:id/redeem-credit', authentication, RequestController.redeemCredit);
router.post('/midtrans/notification', RequestController.midtransNotification);

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

router.get('/places/photo', authentication, OrganizationController.photo);
router.get('/organizations', authentication, OrganizationController.list);
router.post(
  '/organizations/claim',
  authentication,
  organizationAuthorization,
  OrganizationController.claim,
);
router.get('/organizations/:id', authentication, OrganizationController.detail);
router.post(
  '/organizations',
  authentication,
  organizationAuthorization,
  OrganizationController.create,
);

router.get('/notifications', authentication, NotificationController.list);
router.patch('/notifications/read-all', authentication, NotificationController.markReadAll);
router.patch('/notifications/:id/read', authentication, NotificationController.markRead);

router.get(
  '/admin/organizations',
  authentication,
  adminAuthorization,
  AdminController.organizations,
);
router.post(
  '/admin/organizations',
  authentication,
  adminAuthorization,
  AdminController.createOrganization,
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
router.get('/admin/stats', authentication, adminAuthorization, AdminController.stats);
router.post('/admin/users/:id/warn', authentication, adminAuthorization, AdminController.warnUser);
router.post('/admin/users/:id/ban', authentication, adminAuthorization, AdminController.banUser);
router.delete(
  '/admin/items/:id',
  authentication,
  adminAuthorization,
  AdminController.removeItem,
);
router.post(
  '/admin/ai/organization',
  authentication,
  adminAuthorization,
  AdminController.researchOrganization,
);

router.post('/reviews', authentication, ReviewController.create);
router.post('/reports', authentication, ReportController.create);
router.post('/ai/chat', authentication, AiController.chat);
router.post('/ai/match', authentication, AiController.match);

module.exports = router;
