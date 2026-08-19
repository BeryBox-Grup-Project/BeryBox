const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Organization,
  Item,
  Request,
  Conversation,
} = require('../models');
const { haversineKm } = require('../helpers/haversine');
const { suggestShipping } = require('../helpers/shipping');
const { settleCredit } = require('../helpers/credit');
const { normalizeConversationPair } = require('../helpers/conversationPair');
const { stripCoordinates } = require('../helpers/geoPrivacy');

const REQUEST_TYPES = ['claim', 'org_offer', 'barter'];
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
  'status',
  'latitude',
  'longitude',
];

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

function requestResponse(request) {
  return Object.fromEntries(REQUEST_FIELDS.map((field) => [field, request[field] ?? null]));
}

function itemResponse(item, includeCoordinates) {
  const response = Object.fromEntries(ITEM_FIELDS.map((field) => [field, item[field]]));
  return includeCoordinates ? response : stripCoordinates(response);
}

function requestListResponse(request) {
  const canViewCoordinates = ['accepted', 'completed'].includes(request.status);
  return {
    ...requestResponse(request),
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

async function createClaim(req) {
  if (!hasExactFields(req.body, ['type', 'itemId', 'reason'])) {
    throw createError(400, 'Validation error');
  }
  const { itemId, reason } = req.body;
  if (!isPositiveInteger(itemId) || typeof reason !== 'string' || reason.length < 20) {
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
  if (!organization || organization.verified !== 'approved') {
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

async function create(req, res, next) {
  try {
    if (!REQUEST_TYPES.includes(req.body?.type)) throw createError(400, 'Validation error');

    let request;
    if (req.body.type === 'claim') request = await createClaim(req);
    if (req.body.type === 'org_offer') request = await createOrgOffer(req);
    if (req.body.type === 'barter') request = await createBarter(req);

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

function validateShipping(request, item, fromUser, shippingMethod) {
  if (typeof shippingMethod !== 'string') throw createError(400, 'Invalid shipping method');
  const distanceKm = haversineKm(
    item.latitude,
    item.longitude,
    fromUser.latitude,
    fromUser.longitude,
  );
  if (!suggestShipping(distanceKm).includes(shippingMethod)) {
    throw createError(400, 'Invalid shipping method');
  }
}

async function acceptStandardRequest(request, shippingMethod, transaction) {
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

  validateShipping(request, item, fromUser, shippingMethod);
  await request.update({ status: 'accepted', shippingMethod }, { transaction });

  if (request.type === 'claim') {
    await Request.update(
      { status: 'rejected' },
      {
        where: {
          id: { [Op.ne]: request.id },
          itemId: request.itemId,
          type: 'claim',
          status: 'pending',
        },
        transaction,
      },
    );
  }

  await item.update({ status: 'pending' }, { transaction });
  await findOrCreateConversation(request.fromUserId, request.toUserId, item.id, transaction);
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

  await item.update({ status: 'completed' }, { transaction });
  await targetItem.update({ status: 'completed' }, { transaction });
  await request.update({ status: 'completed', shippingMethod: null }, { transaction });
  await findOrCreateConversation(request.fromUserId, request.toUserId, targetItem.id, transaction);
}

async function completeStandardRequest(request, transaction) {
  const item = await Item.findByPk(request.itemId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!item) throw createError(404, 'Not found');
  await request.update({ status: 'completed' }, { transaction });
  await item.update({ status: 'completed' }, { transaction });
}

async function update(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    if (!hasExactFields(req.body, ['status', 'shippingMethod'])) {
      throw createError(400, 'Validation error');
    }
    const { status, shippingMethod } = req.body;
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

    if (status === 'accepted') {
      if (request.status !== 'pending') throw createError(400, 'Validation error');
      if (request.type === 'barter') {
        if (shippingMethod !== undefined) throw createError(400, 'Validation error');
        await acceptBarter(request, transaction);
      } else {
        await acceptStandardRequest(request, shippingMethod, transaction);
      }
    } else if (status === 'rejected') {
      if (request.status !== 'pending' || shippingMethod !== undefined) {
        throw createError(400, 'Validation error');
      }
      await request.update({ status: 'rejected' }, { transaction });
    } else {
      if (request.type === 'barter' || request.status !== 'accepted' || shippingMethod !== undefined) {
        throw createError(400, 'Validation error');
      }
      await completeStandardRequest(request, transaction);
    }

    await transaction.commit();
    return res.status(200).json(requestResponse(request));
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
    await targetItem.update({ status: 'completed' }, { transaction });
    await request.update({ status: 'completed' }, { transaction });
    await findOrCreateConversation(request.fromUserId, request.toUserId, targetItem.id, transaction);

    await transaction.commit();
    return res.status(200).json(requestResponse(request));
  } catch (error) {
    await transaction.rollback();
    return next(error);
  }
}

module.exports = {
  create,
  incoming,
  outgoing,
  update,
  redeemCredit,
};
