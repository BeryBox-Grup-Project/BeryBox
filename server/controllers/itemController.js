const { Op } = require('sequelize');
const { Item, Request, User } = require('../models');
const { haversineKm } = require('../helpers/haversine');
const { suggestShipping } = require('../helpers/shipping');
const { isItemEligible } = require('../helpers/eligibility');
const { stripCoordinates } = require('../helpers/geoPrivacy');
const { isImageKitUrl } = require('../helpers/imagekit');
const nominatim = require('../helpers/nominatim');

const ITEM_TYPES = ['public', 'organization', 'barter'];
const ITEM_CATEGORIES = ['clothes', 'books', 'electronics', 'furniture', 'toys', 'kitchen', 'other'];
const CREATE_FIELDS = [
  'type',
  'title',
  'description',
  'condition',
  'category',
  'creditValue',
  'latitude',
  'longitude',
  'imageUrl',
];
const UPDATE_FIELDS = [
  'title',
  'description',
  'condition',
  'category',
  'creditValue',
  'imageUrl',
  'latitude',
  'longitude',
];
const OWNER_ATTRIBUTES = ['id', 'username', 'ratingAvg'];

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hasOnlyFields(body, fields) {
  return body
    && typeof body === 'object'
    && !Array.isArray(body)
    && Object.keys(body).every((field) => fields.includes(field));
}

function parseCoordinates(lat, lng) {
  if (lat === undefined || lng === undefined) return null;
  if (
    (typeof lat === 'string' && !lat.trim())
    || (typeof lng === 'string' && !lng.trim())
  ) {
    throw createError(400, 'Validation error');
  }

  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw createError(400, 'Validation error');
  }

  return { latitude, longitude };
}

function itemDistance(item, coordinates) {
  if (!coordinates || item.latitude == null || item.longitude == null) return undefined;
  return Number(haversineKm(
    coordinates.latitude,
    coordinates.longitude,
    item.latitude,
    item.longitude,
  ).toFixed(1));
}

async function pendingClaimCount(item) {
  if (item.type !== 'public') return 0;

  return Request.count({
    where: {
      itemId: item.id,
      type: 'claim',
      status: 'pending',
    },
  });
}

async function serializeItem(item, { coordinates, includeCoordinates = false } = {}) {
  const distanceKm = itemDistance(item, coordinates);
  const response = {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    condition: item.condition,
    category: item.category,
    creditValue: item.creditValue,
    addressLabel: item.addressLabel,
    pendingClaimCount: await pendingClaimCount(item),
    imageUrl: item.imageUrl,
    status: item.status,
    owner: item.owner ? {
      id: item.owner.id,
      username: item.owner.username,
      ratingAvg: item.owner.ratingAvg,
    } : undefined,
  };

  if (distanceKm !== undefined) response.distanceKm = distanceKm;
  if (includeCoordinates) {
    response.latitude = item.latitude;
    response.longitude = item.longitude;
  }

  return response;
}

async function findItemWithOwner(id) {
  return Item.findByPk(id, {
    include: [{ model: User, as: 'owner', attributes: OWNER_ATTRIBUTES }],
  });
}

async function list(req, res, next) {
  try {
    const { type, category, lat, lng } = req.query;
    if ((type && !ITEM_TYPES.includes(type)) || (category && !ITEM_CATEGORIES.includes(category))) {
      throw createError(400, 'Validation error');
    }

    const coordinates = lat !== undefined && lng !== undefined ? parseCoordinates(lat, lng) : null;
    const where = { status: 'available' };
    if (type) where.type = type;
    if (category) where.category = category;

    const items = await Item.findAll({
      where,
      include: [{ model: User, as: 'owner', attributes: OWNER_ATTRIBUTES }],
      order: [['createdAt', 'DESC']],
    });
    const serializedItems = await Promise.all(items.map((item) => serializeItem(item, { coordinates })));
    if (coordinates) serializedItems.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

    return res.status(200).json(serializedItems.map(stripCoordinates));
  } catch (error) {
    return next(error);
  }
}

async function mine(req, res, next) {
  try {
    const items = await Item.findAll({
      where: { ownerId: req.user.id },
      include: [{ model: User, as: 'owner', attributes: OWNER_ATTRIBUTES }],
      order: [['createdAt', 'DESC']],
    });
    const response = await Promise.all(items.map((item) => serializeItem(item, { includeCoordinates: true })));
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
}

async function canViewCoordinates(userId, item) {
  if (userId === item.ownerId) return true;

  const request = await Request.findOne({
    where: {
      [Op.and]: [
        { [Op.or]: [{ itemId: item.id }, { targetItemId: item.id }] },
        { [Op.or]: [{ fromUserId: userId }, { toUserId: userId }] },
        { status: { [Op.in]: ['accepted', 'completed'] } },
      ],
    },
  });
  return Boolean(request);
}

async function detail(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw createError(404, 'Not found');

    const item = await findItemWithOwner(id);
    if (!item) throw createError(404, 'Not found');

    const { lat, lng } = req.query;
    const coordinates = lat !== undefined && lng !== undefined ? parseCoordinates(lat, lng) : null;
    const includeCoordinates = await canViewCoordinates(req.user.id, item);
    const response = await serializeItem(item, { coordinates, includeCoordinates });
    response.suggestedShipping = coordinates && response.distanceKm !== undefined
      ? suggestShipping(response.distanceKm)
      : [];

    if (req.user.id === item.ownerId && item.type === 'public') {
      const claims = await Request.findAll({
        where: { itemId: item.id, type: 'claim' },
        include: [{
          model: User,
          as: 'fromUser',
          attributes: OWNER_ATTRIBUTES,
        }],
        order: [['createdAt', 'DESC']],
      });
      response.claims = claims.map((claim) => ({
        id: claim.id,
        fromUserId: claim.fromUserId,
        reason: claim.reason,
        status: claim.status,
        fromUser: {
          id: claim.fromUser.id,
          username: claim.fromUser.username,
          ratingAvg: claim.fromUser.ratingAvg,
        },
      }));
    }

    return res.status(200).json(includeCoordinates ? response : stripCoordinates(response));
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    if (!hasOnlyFields(req.body, CREATE_FIELDS)) throw createError(400, 'Validation error');

    const {
      type,
      title,
      description,
      condition,
      category,
      creditValue = 0,
      latitude,
      longitude,
      imageUrl,
    } = req.body;
    if (
      !ITEM_TYPES.includes(type)
      || typeof title !== 'string'
      || !title.trim()
      || !Number.isInteger(creditValue)
      || creditValue < 0
      || typeof latitude !== 'number'
      || !Number.isFinite(latitude)
      || typeof longitude !== 'number'
      || !Number.isFinite(longitude)
    ) {
      throw createError(400, 'Validation error');
    }

    const eligibility = isItemEligible({ condition, category, description });
    if (!eligibility.eligible) throw createError(400, eligibility.message);
    if (!isImageKitUrl(imageUrl)) throw createError(400, 'Invalid image url');

    const addressLabel = await nominatim.reverse(latitude, longitude);
    const item = await Item.create({
      ownerId: req.user.id,
      type,
      title,
      description,
      condition,
      category,
      creditValue,
      latitude,
      longitude,
      addressLabel,
      imageUrl,
      status: 'available',
    });
    const createdItem = await findItemWithOwner(item.id);
    return res.status(201).json(await serializeItem(createdItem, { includeCoordinates: true }));
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    if (!hasOnlyFields(req.body, UPDATE_FIELDS)) throw createError(400, 'Validation error');

    const changes = { ...req.body };
    if (changes.title !== undefined && (typeof changes.title !== 'string' || !changes.title.trim())) {
      throw createError(400, 'Validation error');
    }
    if (changes.creditValue !== undefined && (!Number.isInteger(changes.creditValue) || changes.creditValue < 0)) {
      throw createError(400, 'Validation error');
    }

    const eligibilityChanged = ['description', 'condition', 'category']
      .some((field) => changes[field] !== undefined);
    if (eligibilityChanged) {
      const eligibility = isItemEligible({
        description: changes.description ?? req.item.description,
        condition: changes.condition ?? req.item.condition,
        category: changes.category ?? req.item.category,
      });
      if (!eligibility.eligible) throw createError(400, eligibility.message);
    }

    if (changes.imageUrl !== undefined && !isImageKitUrl(changes.imageUrl)) {
      throw createError(400, 'Invalid image url');
    }

    const latitudeProvided = changes.latitude !== undefined;
    const longitudeProvided = changes.longitude !== undefined;
    if (latitudeProvided !== longitudeProvided) throw createError(400, 'Validation error');
    if (latitudeProvided) {
      if (
        typeof changes.latitude !== 'number'
        || !Number.isFinite(changes.latitude)
        || typeof changes.longitude !== 'number'
        || !Number.isFinite(changes.longitude)
      ) {
        throw createError(400, 'Validation error');
      }
      changes.addressLabel = await nominatim.reverse(changes.latitude, changes.longitude);
    }

    await req.item.update(changes);
    const updatedItem = await findItemWithOwner(req.item.id);
    return res.status(200).json(await serializeItem(updatedItem, { includeCoordinates: true }));
  } catch (error) {
    return next(error);
  }
}

async function cancel(req, res, next) {
  try {
    await req.item.update({ status: 'cancelled' });
    return res.status(200).json({ message: 'Item cancelled' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, mine, detail, create, update, cancel };
