const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Organization,
  Item,
  Request,
  Conversation,
  Shipment,
} = require('../models');
const { haversineKm } = require('../helpers/haversine');
const { suggestShipping, shippingFee, SHIPPING_METHODS } = require('../helpers/shipping');
const { settleCredit } = require('../helpers/credit');
const { normalizeConversationPair } = require('../helpers/conversationPair');
const { stripCoordinates } = require('../helpers/geoPrivacy');
const { notify } = require('../services/notificationService');
const midtrans = require('../helpers/midtrans');

const REQUEST_TYPES = ['claim', 'org_offer', 'barter', 'credit'];
const REQUEST_FIELDS = [
  'id',
  'type',
  'fromUserId',
  'toUserId',
  'itemId',
  'targetItemId',
  'reason',
  'shippingMethod',
  'status',
];
const ITEM_FIELDS = [
  'id',
  'type',
  'title',
  'description',
  'condition',
  'category',
  'creditValue',
  'addressLabel',
  'imageUrl',
  'wantedTitle',
  'wantedDescription',
  'wantedImageUrl',
  'wantedCategory',
  'status',
  'latitude',
  'longitude',
];
const TRACKING_NEXT = {
  ready_for_pickup: ['delivered'],
  preparing: ['in_transit'],
  in_transit: ['delivered'],
};

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function hasExactFields(body, allowedFields) {
  return body
    && typeof body === 'object'
    && !Array.isArray(body)
    && Object.keys(body).every((field) => allowedFields.includes(field));
}

function shipmentResponse(shipment) {
  if (!shipment) return null;
  return {
    id: shipment.id,
    requestId: shipment.requestId,
    method: shipment.method,
    payer: shipment.payer,
    paymentStatus: shipment.paymentStatus,
    trackingStatus: shipment.trackingStatus,
    grossAmount: shipment.grossAmount,
  };
}

function requestResponse(request, shipment) {
  return {
    ...Object.fromEntries(REQUEST_FIELDS.map((field) => [field, request[field] ?? null])),
    shipment: shipmentResponse(shipment || request.Shipment),
  };
}

function itemResponse(item, includeCoordinates) {
  const response = Object.fromEntries(ITEM_FIELDS.map((field) => [field, item[field] ?? null]));
  return includeCoordinates ? response : stripCoordinates(response);
}

function requestListResponse(request) {
  const canViewCoordinates = ['accepted', 'completed'].includes(request.status);
  return {
    ...requestResponse(request, request.Shipment),
    fromUser: {
      id: request.fromUser.id,
      username: request.fromUser.username,
      ratingAvg: request.fromUser.ratingAvg,
    },
    item: itemResponse(request.Item, canViewCoordinates),
  };
}

async function findOrCreateConversation(userId1, userId2, itemId, transaction) {
  const pair = normalizeConversationPair(userId1, userId2);
  const [conversation] = await Conversation.findOrCreate({
    where: pair,
    defaults: { ...pair, itemId },
    transaction,
  });
  return conversation;
}

async function createShipment(request, transaction) {
  return Shipment.create({
    requestId: request.id,
    method: null,
    payer: 'from_user',
    paymentStatus: 'not_required',
    trackingStatus: 'awaiting_method',
    grossAmount: 0,
  }, { transaction });
}

async function createClaim(req) {
  if (!hasExactFields(req.body, ['type', 'itemId', 'reason'])) {
    throw createError(400, 'Validation error');
  }
  const { itemId, reason } = req.body;
  if (!isPositiveInteger(itemId) || typeof reason !== 'string' || !reason.trim()) {
    throw createError(400, 'Validation error');
  }

  const item = await Item.findByPk(itemId);
  if (!item) throw createError(404, 'Not found');
  if (item.ownerId === req.user.id) throw createError(400, 'Cannot request your own item');
  if (item.status !== 'available' || item.type !== 'public') {
    throw createError(400, 'Validation error');
  }

  const duplicate = await Request.findOne({
    where: {
      type: 'claim',
      fromUserId: req.user.id,
      itemId,
      status: 'pending',
    },
  });
  if (duplicate) throw createError(400, 'Claim already exists');

  return Request.create({
    type: 'claim',
    fromUserId: req.user.id,
    toUserId: item.ownerId,
    itemId,
    targetItemId: null,
    reason,
    shippingMethod: null,
    status: 'pending',
  });
}

async function createOrgOffer(req) {
  if (!hasExactFields(req.body, ['type', 'itemId', 'toUserId'])) {
    throw createError(400, 'Validation error');
  }
  const { itemId, toUserId } = req.body;
  if (!isPositiveInteger(itemId) || !isPositiveInteger(toUserId)) {
    throw createError(400, 'Validation error');
  }
  if (toUserId === req.user.id) throw createError(400, 'Cannot request your own item');

  const [item, targetUser] = await Promise.all([
    Item.findByPk(itemId),
    User.findByPk(toUserId),
  ]);
  if (!item || !targetUser) throw createError(404, 'Not found');
  if (item.ownerId !== req.user.id) throw createError(403, 'Forbidden');
  if (item.status !== 'available' || !['public', 'organization'].includes(item.type)) {
    throw createError(400, 'Validation error');
  }
  if (targetUser.role !== 'organization') throw createError(400, 'Validation error');

  const organization = await Organization.findOne({ where: { userId: toUserId } });
  if (!organization || organization.verified === 'rejected' || !organization.userId) {
    throw createError(403, 'Organization is not verified');
  }

  return Request.create({
    type: 'org_offer',
    fromUserId: req.user.id,
    toUserId,
    itemId,
    targetItemId: null,
    reason: null,
    shippingMethod: null,
    status: 'pending',
  });
}

async function createBarter(req) {
  if (!hasExactFields(req.body, ['type', 'itemId', 'targetItemId'])) {
    throw createError(400, 'Validation error');
  }
  const { itemId, targetItemId } = req.body;
  if (!isPositiveInteger(itemId) || !isPositiveInteger(targetItemId) || itemId === targetItemId) {
    throw createError(400, 'Validation error');
  }

  const [item, targetItem] = await Promise.all([
    Item.findByPk(itemId),
    Item.findByPk(targetItemId),
  ]);
  if (!item || !targetItem) throw createError(404, 'Not found');
  if (item.ownerId !== req.user.id) throw createError(403, 'Forbidden');
  if (targetItem.ownerId === req.user.id) throw createError(400, 'Cannot request your own item');
  if (item.status !== 'available' || targetItem.status !== 'available' || targetItem.type !== 'barter') {
    throw createError(400, 'Validation error');
  }

  return Request.create({
    type: 'barter',
    fromUserId: req.user.id,
    toUserId: targetItem.ownerId,
    itemId,
    targetItemId,
    reason: null,
    shippingMethod: null,
    status: 'pending',
  });
}

async function createCredit(req) {
  if (!hasExactFields(req.body, ['type', 'itemId'])) {
    throw createError(400, 'Validation error');
  }
  const { itemId } = req.body;
  if (!isPositiveInteger(itemId)) throw createError(400, 'Validation error');

  const item = await Item.findByPk(itemId);
  if (!item) throw createError(404, 'Not found');
  if (item.ownerId === req.user.id) throw createError(400, 'Cannot request your own item');
  if (item.status !== 'available' || item.type !== 'barter') {
    throw createError(400, 'Validation error');
  }

  const duplicate = await Request.findOne({
    where: {
      type: 'credit',
      fromUserId: req.user.id,
      itemId,
      status: 'pending',
    },
  });
  if (duplicate) throw createError(400, 'Claim already exists');

  return Request.create({
    type: 'credit',
    fromUserId: req.user.id,
    toUserId: item.ownerId,
    itemId,
    targetItemId: null,
    reason: null,
    shippingMethod: null,
    status: 'pending',
  });
}

async function create(req, res, next) {
  try {
    if (!REQUEST_TYPES.includes(req.body?.type)) throw createError(400, 'Validation error');

    let request;
    if (req.body.type === 'claim') request = await createClaim(req);
    if (req.body.type === 'org_offer') request = await createOrgOffer(req);
    if (req.body.type === 'barter') request = await createBarter(req);
    if (req.body.type === 'credit') request = await createCredit(req);

    const notificationType = request.type === 'claim' ? 'claim' : 'offer';
    const action = request.type === 'claim'
      ? 'claimed your item'
      : request.type === 'org_offer'
        ? 'offered you an item'
        : request.type === 'credit'
          ? 'offered credits for your item'
          : 'sent you a barter offer';
    await notify(request.toUserId, {
      type: notificationType,
      requestId: request.id,
      conversationId: null,
      message: `${req.authUser.username} ${action}`,
    });

    return res.status(201).json(requestResponse(request));
  } catch (error) {
    return next(error);
  }
}

async function listRequests(req, res, next, direction) {
  try {
    const where = direction === 'incoming'
      ? { toUserId: req.user.id }
      : { fromUserId: req.user.id };
    const requests = await Request.findAll({
      where,
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'username', 'ratingAvg'] },
        { model: Item },
        { model: Shipment },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json(requests.map(requestListResponse));
  } catch (error) {
    return next(error);
  }
}

function incoming(req, res, next) {
  return listRequests(req, res, next, 'incoming');
}

function outgoing(req, res, next) {
  return listRequests(req, res, next, 'outgoing');
}

function requestDistanceKm(item, fromUser) {
  return haversineKm(item.latitude, item.longitude, fromUser.latitude, fromUser.longitude);
}

function validateShippingMethod(item, fromUser, method) {
  if (!SHIPPING_METHODS.includes(method)) throw createError(400, 'Invalid shipping method');
  const distanceKm = requestDistanceKm(item, fromUser);
  if (!suggestShipping(distanceKm).includes(method)) {
    throw createError(400, 'Invalid shipping method');
  }
  return distanceKm;
}

async function rejectCompeting(request, transaction) {
  const where = {
    id: { [Op.ne]: request.id },
    status: 'pending',
  };
  if (request.type === 'claim') {
    where.itemId = request.itemId;
    where.type = 'claim';
  } else if (request.type === 'credit') {
    where.itemId = request.itemId;
    where.type = { [Op.in]: ['credit', 'barter'] };
  } else if (request.type === 'barter') {
    where[Op.or] = [
      { itemId: request.itemId, type: { [Op.in]: ['barter', 'credit'] } },
      { targetItemId: request.targetItemId, type: 'barter' },
      { itemId: request.targetItemId, type: { [Op.in]: ['barter', 'credit'] } },
    ];
  } else {
    return [];
  }

  const rejected = await Request.findAll({ where, transaction, lock: transaction.LOCK.UPDATE });
  if (rejected.length) {
    await Request.update({ status: 'rejected' }, { where: { id: rejected.map((row) => row.id) }, transaction });
  }
  return rejected;
}

async function acceptStandardRequest(request, transaction) {
  const item = await Item.findByPk(request.itemId, { transaction, lock: transaction.LOCK.UPDATE });
  const fromUser = await User.findByPk(request.fromUserId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!item || !fromUser) throw createError(404, 'Not found');
  if (item.status !== 'available') throw createError(400, 'Validation error');

  if (request.type === 'org_offer') {
    const organization = await Organization.findOne({
      where: { userId: request.toUserId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!organization || organization.verified !== 'approved') {
      throw createError(403, 'Organization is not verified');
    }
  }

  if (request.type === 'credit') {
    const owner = await User.findByPk(request.toUserId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!owner) throw createError(404, 'Not found');
    if (fromUser.creditBalance < item.creditValue) throw createError(400, 'Insufficient credit');
    await fromUser.update({ creditBalance: fromUser.creditBalance - item.creditValue }, { transaction });
    await owner.update({ creditBalance: owner.creditBalance + item.creditValue }, { transaction });
  }

  await request.update({ status: 'accepted', shippingMethod: null }, { transaction });
  const rejectedClaims = await rejectCompeting(request, transaction);
  await item.update({ status: 'pending' }, { transaction });
  const conversation = await findOrCreateConversation(
    request.fromUserId,
    request.toUserId,
    item.id,
    transaction,
  );
  const shipment = await createShipment(request, transaction);
  return { conversation, rejectedClaims, shipment };
}

async function acceptBarter(request, transaction) {
  const item = await Item.findByPk(request.itemId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const targetItem = await Item.findByPk(request.targetItemId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!item || !targetItem) throw createError(404, 'Not found');
  if (
    item.status !== 'available'
    || targetItem.status !== 'available'
    || item.ownerId !== request.fromUserId
    || targetItem.ownerId !== request.toUserId
    || targetItem.type !== 'barter'
  ) {
    throw createError(400, 'Validation error');
  }

  const settlement = settleCredit(item.creditValue, targetItem.creditValue);
  const ownerA = await User.findByPk(item.ownerId, { transaction, lock: transaction.LOCK.UPDATE });
  const ownerB = await User.findByPk(targetItem.ownerId, { transaction, lock: transaction.LOCK.UPDATE });
  const payer = settlement.payer === 'A' ? ownerA : ownerB;
  const receiver = settlement.receiver === 'A' ? ownerA : ownerB;

  if (settlement.amount > 0) {
    if (payer.creditBalance < settlement.amount) throw createError(400, 'Insufficient credit');
    await payer.update({ creditBalance: payer.creditBalance - settlement.amount }, { transaction });
    await receiver.update({ creditBalance: receiver.creditBalance + settlement.amount }, { transaction });
  }

  await item.update({ status: 'pending' }, { transaction });
  await targetItem.update({ status: 'pending' }, { transaction });
  await request.update({ status: 'accepted', shippingMethod: null }, { transaction });
  await rejectCompeting(request, transaction);
  const conversation = await findOrCreateConversation(
    request.fromUserId,
    request.toUserId,
    targetItem.id,
    transaction,
  );
  const shipment = await createShipment(request, transaction);
  return { conversation, shipment };
}

async function completeRequest(request, transaction) {
  const shipment = await Shipment.findOne({
    where: { requestId: request.id },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!shipment || shipment.trackingStatus === 'awaiting_method' || shipment.trackingStatus === 'awaiting_payment') {
    throw createError(400, 'Validation error');
  }
  if (shipment.paymentStatus === 'unpaid') throw createError(400, 'Validation error');

  const item = await Item.findByPk(request.itemId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!item) throw createError(404, 'Not found');
  await request.update({ status: 'completed' }, { transaction });
  await item.update({ status: 'completed' }, { transaction });
  if (request.targetItemId) {
    const targetItem = await Item.findByPk(request.targetItemId, { transaction, lock: transaction.LOCK.UPDATE });
    if (targetItem) await targetItem.update({ status: 'completed' }, { transaction });
  }
  if (shipment.trackingStatus !== 'delivered') {
    await shipment.update({ trackingStatus: 'delivered' }, { transaction });
  }
  return shipment;
}

async function update(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    const notifications = [];
    if (!hasExactFields(req.body, ['status'])) {
      throw createError(400, 'Validation error');
    }
    const { status } = req.body;
    if (!['accepted', 'rejected', 'completed'].includes(status)) {
      throw createError(400, 'Validation error');
    }

    const id = Number(req.params.id);
    if (!isPositiveInteger(id)) throw createError(404, 'Not found');
    const request = await Request.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) throw createError(404, 'Not found');

    if (['accepted', 'rejected'].includes(status) && req.user.id !== request.toUserId) {
      throw createError(403, 'Forbidden');
    }
    if (status === 'completed' && ![request.fromUserId, request.toUserId].includes(req.user.id)) {
      throw createError(403, 'Forbidden');
    }

    let shipment = null;
    if (status === 'accepted') {
      if (request.status !== 'pending') throw createError(400, 'Validation error');
      if (request.type === 'barter') {
        const result = await acceptBarter(request, transaction);
        shipment = result.shipment;
        notifications.push({
          userId: request.fromUserId,
          payload: {
            type: 'accepted',
            requestId: request.id,
            conversationId: result.conversation.id,
            message: 'Your barter request was accepted',
          },
        });
        notifications.push({
          userId: request.fromUserId,
          payload: {
            type: 'shipping_required',
            requestId: request.id,
            conversationId: result.conversation.id,
            message: 'Choose a shipping method to continue',
          },
        });
      } else {
        const result = await acceptStandardRequest(request, transaction);
        shipment = result.shipment;
        const shippingUserId = request.type === 'org_offer' ? request.toUserId : request.fromUserId;
        notifications.push({
          userId: request.fromUserId,
          payload: {
            type: 'accepted',
            requestId: request.id,
            conversationId: result.conversation.id,
            message: 'Your request was accepted',
          },
        });
        notifications.push({
          userId: shippingUserId,
          payload: {
            type: 'shipping_required',
            requestId: request.id,
            conversationId: result.conversation.id,
            message: 'Choose a shipping method to continue',
          },
        });
        result.rejectedClaims.forEach((rejectedClaim) => {
          notifications.push({
            userId: rejectedClaim.fromUserId,
            payload: {
              type: 'rejected',
              requestId: rejectedClaim.id,
              conversationId: null,
              message: 'Your request was rejected',
            },
          });
        });
      }
    } else if (status === 'rejected') {
      if (request.status !== 'pending') {
        throw createError(400, 'Validation error');
      }
      await request.update({ status: 'rejected' }, { transaction });
      notifications.push({
        userId: request.fromUserId,
        payload: {
          type: 'rejected',
          requestId: request.id,
          conversationId: null,
          message: 'Your request was rejected',
        },
      });
    } else {
      if (request.status !== 'accepted') {
        throw createError(400, 'Validation error');
      }
      shipment = await completeRequest(request, transaction);
      notifications.push({
        userId: request.fromUserId === req.user.id ? request.toUserId : request.fromUserId,
        payload: {
          type: 'delivered',
          requestId: request.id,
          conversationId: null,
          message: 'The item was marked as received',
        },
      });
    }

    await transaction.commit();
    await Promise.all(notifications.map(({ userId, payload }) => notify(userId, payload)));
    return res.status(200).json(requestResponse(request, shipment));
  } catch (error) {
    await transaction.rollback();
    return next(error);
  }
}

function canSetShipping(request, userId) {
  if (request.type === 'org_offer') return userId === request.toUserId;
  return userId === request.fromUserId;
}

async function setShipping(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    if (!hasExactFields(req.body, ['method', 'payer']) && !hasExactFields(req.body, ['method'])) {
      throw createError(400, 'Validation error');
    }
    const method = req.body.method;
    const payer = req.body.payer || 'from_user';
    if (!['from_user', 'to_user'].includes(payer)) throw createError(400, 'Validation error');

    const id = Number(req.params.id);
    if (!isPositiveInteger(id)) throw createError(404, 'Not found');
    const request = await Request.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) throw createError(404, 'Not found');
    if (request.status !== 'accepted') throw createError(400, 'Validation error');
    if (!canSetShipping(request, req.user.id)) throw createError(403, 'Forbidden');

    const shipment = await Shipment.findOne({
      where: { requestId: request.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!shipment || shipment.trackingStatus !== 'awaiting_method') {
      throw createError(400, 'Validation error');
    }

    const item = await Item.findByPk(request.itemId, { transaction });
    const fromUser = await User.findByPk(request.fromUserId, { transaction });
    if (!item || !fromUser) throw createError(404, 'Not found');
    const distanceKm = validateShippingMethod(item, fromUser, method);
    const grossAmount = shippingFee(method, distanceKm);
    const paymentStatus = method === 'pickup' ? 'not_required' : 'unpaid';
    const trackingStatus = method === 'pickup' ? 'ready_for_pickup' : 'awaiting_payment';

    await shipment.update({
      method,
      payer,
      paymentStatus,
      trackingStatus,
      grossAmount,
    }, { transaction });
    await request.update({ shippingMethod: method }, { transaction });
    await transaction.commit();

    if (method === 'courier_agent') {
      const payerId = payer === 'from_user' ? request.fromUserId : request.toUserId;
      await notify(payerId, {
        type: 'payment_required',
        requestId: request.id,
        conversationId: null,
        message: 'Pay shipping to continue delivery',
      });
    }

    return res.status(200).json(requestResponse(request, shipment));
  } catch (error) {
    await transaction.rollback();
    return next(error);
  }
}

async function markShipmentPaid(shipment) {
  if (shipment.paymentStatus === 'paid') return shipment;
  await shipment.update({ paymentStatus: 'paid', trackingStatus: 'preparing' });
  const request = await Request.findByPk(shipment.requestId);
  await notify(request.fromUserId, {
    type: 'tracking_updated',
    requestId: request.id,
    conversationId: null,
    message: 'Shipping payment received',
  });
  await notify(request.toUserId, {
    type: 'tracking_updated',
    requestId: request.id,
    conversationId: null,
    message: 'Shipping payment received',
  });
  return shipment;
}

async function loadPayableShipment(req) {
  const id = Number(req.params.id);
  if (!isPositiveInteger(id)) throw createError(404, 'Not found');
  const request = await Request.findByPk(id, { include: [Shipment] });
  if (!request || !request.Shipment) throw createError(404, 'Not found');
  if (![request.fromUserId, request.toUserId].includes(req.user.id)) {
    throw createError(403, 'Forbidden');
  }
  const shipment = request.Shipment;
  const payerId = shipment.payer === 'from_user' ? request.fromUserId : request.toUserId;
  if (req.user.id !== payerId) throw createError(403, 'Forbidden');
  if (shipment.method !== 'courier_agent') throw createError(400, 'Validation error');
  return { request, shipment };
}

async function createPayment(req, res, next) {
  try {
    const { request, shipment } = await loadPayableShipment(req);
    if (shipment.paymentStatus !== 'unpaid') {
      throw createError(400, 'Validation error');
    }

    const payer = await User.findByPk(req.user.id);
    const orderId = `berybox-${request.id}-${Date.now()}`;

    if (!midtrans.isConfigured()) {
      if (process.env.NODE_ENV === 'test') {
        await shipment.update({
          midtransOrderId: orderId,
          paymentStatus: 'paid',
          trackingStatus: 'preparing',
        });
        return res.status(200).json({
          token: null,
          redirect_url: null,
          simulated: true,
          orderId,
          grossAmount: shipment.grossAmount,
        });
      }
      throw createError(502, 'Payment service unavailable');
    }

    let snap;
    try {
      snap = await midtrans.createSnapTransaction({
        orderId,
        grossAmount: shipment.grossAmount,
        email: payer.email,
        firstName: payer.username,
      });
    } catch (error) {
      error.status = error.status || 502;
      error.message = 'Payment service unavailable';
      throw error;
    }
    await shipment.update({ midtransOrderId: orderId, snapToken: snap.token });
    return res.status(200).json({
      token: snap.token,
      redirect_url: snap.redirect_url,
      clientKey: midtrans.clientKey(),
      isProduction: midtrans.isProduction(),
      orderId,
      grossAmount: shipment.grossAmount,
    });
  } catch (error) {
    return next(error);
  }
}

async function confirmPayment(req, res, next) {
  try {
    const { request, shipment } = await loadPayableShipment(req);
    if (shipment.paymentStatus === 'paid') {
      return res.status(200).json(requestResponse(request, shipment));
    }
    if (!shipment.midtransOrderId) throw createError(400, 'Validation error');

    let status;
    try {
      status = await midtrans.getTransactionStatus(shipment.midtransOrderId);
    } catch (error) {
      error.status = error.status || 502;
      error.message = 'Payment service unavailable';
      throw error;
    }

    if (midtrans.isPaidStatus(status?.transaction_status)) {
      await markShipmentPaid(shipment);
      await shipment.reload();
    }
    return res.status(200).json(requestResponse(request, shipment));
  } catch (error) {
    return next(error);
  }
}

async function midtransNotification(req, res, next) {
  try {
    const body = req.body || {};
    if (!midtrans.verifyNotificationSignature(body)) {
      throw createError(400, 'Validation error');
    }
    const shipment = await Shipment.findOne({ where: { midtransOrderId: body.order_id } });
    if (!shipment) throw createError(404, 'Not found');

    if (midtrans.isPaidStatus(body.transaction_status) && shipment.paymentStatus !== 'paid') {
      await markShipmentPaid(shipment);
    }
    return res.status(200).json({ message: 'OK' });
  } catch (error) {
    return next(error);
  }
}

async function updateTracking(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    if (!hasExactFields(req.body, ['trackingStatus'])) throw createError(400, 'Validation error');
    const { trackingStatus } = req.body;
    const id = Number(req.params.id);
    if (!isPositiveInteger(id)) throw createError(404, 'Not found');

    const request = await Request.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) throw createError(404, 'Not found');
    if (![request.fromUserId, request.toUserId].includes(req.user.id)) {
      throw createError(403, 'Forbidden');
    }
    if (request.status !== 'accepted') throw createError(400, 'Validation error');

    const shipment = await Shipment.findOne({
      where: { requestId: request.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!shipment) throw createError(404, 'Not found');
    const allowed = TRACKING_NEXT[shipment.trackingStatus] || [];
    if (!allowed.includes(trackingStatus)) throw createError(400, 'Validation error');

    await shipment.update({ trackingStatus }, { transaction });
    if (trackingStatus === 'delivered') {
      await completeRequest(request, transaction);
    }
    await transaction.commit();

    const otherUserId = req.user.id === request.fromUserId ? request.toUserId : request.fromUserId;
    await notify(otherUserId, {
      type: trackingStatus === 'delivered' ? 'delivered' : 'tracking_updated',
      requestId: request.id,
      conversationId: null,
      message: trackingStatus === 'delivered' ? 'The item was delivered' : 'Tracking status updated',
    });
    return res.status(200).json(requestResponse(request, shipment));
  } catch (error) {
    await transaction.rollback();
    return next(error);
  }
}

async function redeemCredit(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!isPositiveInteger(id)) throw createError(404, 'Not found');

    const request = await Request.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) throw createError(404, 'Not found');
    if (req.user.id !== request.fromUserId) throw createError(403, 'Forbidden');
    if (request.type !== 'barter' || request.status !== 'rejected') {
      throw createError(400, 'Validation error');
    }

    const sourceItem = await Item.findByPk(request.itemId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const targetItem = await Item.findByPk(request.targetItemId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!sourceItem || !targetItem) throw createError(404, 'Not found');
    if (targetItem.status !== 'available') throw createError(400, 'Validation error');

    const requester = await User.findByPk(request.fromUserId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const receiver = await User.findByPk(targetItem.ownerId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (requester.creditBalance < targetItem.creditValue) {
      throw createError(400, 'Insufficient credit');
    }

    await requester.update(
      { creditBalance: requester.creditBalance - targetItem.creditValue },
      { transaction },
    );
    await receiver.update(
      { creditBalance: receiver.creditBalance + targetItem.creditValue },
      { transaction },
    );
    await targetItem.update({ status: 'pending' }, { transaction });
    await request.update({ status: 'accepted', type: 'credit' }, { transaction });
    const conversation = await findOrCreateConversation(
      request.fromUserId,
      request.toUserId,
      targetItem.id,
      transaction,
    );
    const shipment = await createShipment(request, transaction);

    await transaction.commit();
    await notify(request.toUserId, {
      type: 'accepted',
      requestId: request.id,
      conversationId: conversation.id,
      message: 'Your item was redeemed with credits',
    });
    await notify(request.fromUserId, {
      type: 'shipping_required',
      requestId: request.id,
      conversationId: conversation.id,
      message: 'Choose a shipping method to continue',
    });
    return res.status(200).json(requestResponse(request, shipment));
  } catch (error) {
    await transaction.rollback();
    return next(error);
  }
}

async function history(req, res, next) {
  try {
    const requests = await Request.findAll({
      where: {
        status: 'completed',
        [Op.or]: [{ fromUserId: req.user.id }, { toUserId: req.user.id }],
      },
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'username', 'ratingAvg'] },
        { model: User, as: 'toUser', attributes: ['id', 'username', 'ratingAvg'] },
        { model: Item },
        { model: Item, as: 'targetItem' },
        { model: Shipment },
      ],
      order: [['updatedAt', 'DESC']],
    });

    const donated = requests.filter((row) => row.toUserId === req.user.id && row.type === 'claim');
    const received = requests.filter((row) => row.fromUserId === req.user.id && ['claim', 'credit'].includes(row.type));
    const offered = requests.filter((row) => row.type === 'org_offer' && row.fromUserId === req.user.id);
    const receivedOffers = requests.filter((row) => row.type === 'org_offer' && row.toUserId === req.user.id);
    const barters = requests.filter((row) => row.type === 'barter');

    return res.status(200).json({
      donated: donated.map(requestListResponse),
      received: received.map(requestListResponse),
      offered: offered.map(requestListResponse),
      receivedOffers: receivedOffers.map(requestListResponse),
      barters: barters.map(requestListResponse),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  create,
  incoming,
  outgoing,
  update,
  setShipping,
  createPayment,
  confirmPayment,
  midtransNotification,
  updateTracking,
  redeemCredit,
  history,
};
