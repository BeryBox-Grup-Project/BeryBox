const { Op } = require('sequelize');
const { User, Organization, Item } = require('../models');
const { haversineKm } = require('../helpers/haversine');
const aiService = require('../services/aiService');
const {
  classifyChatIntent,
  candidateKindsForMessage,
  itemTypesForMessage,
  rankAndSelectCandidates,
  rankBarterCandidates,
} = require('../services/aiInstructions');

const MAX_CANDIDATES = 5;

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function distanceFromUser(user, entity) {
  return Number(haversineKm(
    user.latitude,
    user.longitude,
    entity.latitude,
    entity.longitude,
  ).toFixed(1));
}

function parseOptionalCoordinates(lat, lng) {
  if (lat === undefined && lng === undefined) return null;
  if (lat === undefined || lng === undefined) {
    throw createError(400, 'Validation error');
  }
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw createError(400, 'Validation error');
  }
  return { latitude, longitude };
}

function organizationCandidate(origin, organization) {
  const distanceKm = distanceFromUser(origin, organization);
  return {
    context: {
      kind: 'organization',
      id: organization.id,
      name: organization.name,
      description: organization.description,
      type: organization.type,
      addressLabel: organization.addressLabel,
      distanceKm,
    },
    suggestion: {
      kind: 'organization',
      id: organization.id,
      name: organization.name,
      distanceKm,
    },
  };
}

function itemCandidate(origin, item) {
  const distanceKm = distanceFromUser(origin, item);
  return {
    context: {
      kind: 'item',
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      condition: item.condition,
      wantedTitle: item.wantedTitle,
      wantedCategory: item.wantedCategory,
      addressLabel: item.addressLabel,
      distanceKm,
    },
    suggestion: {
      kind: 'item',
      id: item.id,
      title: item.title,
      distanceKm,
    },
  };
}

async function chat(req, res, next) {
  try {
    const body = req.body;
    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || !Object.keys(body).every((field) => ['message', 'lat', 'lng'].includes(field))
      || typeof body.message !== 'string'
      || !body.message.trim()
    ) {
      throw createError(400, 'Validation error');
    }

    const user = await User.findByPk(req.user.id);
    if (!user) throw createError(404, 'Not found');
    const origin = parseOptionalCoordinates(body.lat, body.lng) || user;

    const message = body.message.trim();
    const intent = classifyChatIntent(message);
    let candidates = [];

    if (intent === 'recommendation') {
      const kinds = candidateKindsForMessage(message);
      const itemTypes = kinds.includes('item') ? itemTypesForMessage(message) : [];
      const [organizations, items] = await Promise.all([
        kinds.includes('organization')
          ? Organization.findAll({
            where: { verified: 'approved' },
            attributes: [
              'id',
              'name',
              'description',
              'type',
              'addressLabel',
              'latitude',
              'longitude',
            ],
          })
          : [],
        itemTypes.length
          ? Item.findAll({
            where: { type: { [Op.in]: itemTypes }, status: 'available' },
            attributes: [
              'id',
              'title',
              'description',
              'category',
              'condition',
              'addressLabel',
              'latitude',
              'longitude',
              'wantedTitle',
              'wantedCategory',
            ],
            include: [{
              model: User,
              as: 'owner',
              attributes: [],
              where: { status: { [Op.ne]: 'banned' } },
            }],
          })
          : [],
      ]);

      const pool = [
        ...organizations
          .filter((organization) => organization.latitude != null && organization.longitude != null)
          .map((organization) => organizationCandidate(origin, organization)),
        ...items
          .filter((item) => item.latitude != null && item.longitude != null)
          .map((item) => itemCandidate(origin, item)),
      ];
      candidates = rankAndSelectCandidates(message, pool, MAX_CANDIDATES);
    }

    let reply;
    try {
      reply = await aiService.generateReply({
        message,
        candidates: candidates.map((candidate) => candidate.context),
      });
    } catch {
      throw createError(502, 'AI service unavailable');
    }

    return res.status(200).json({
      reply,
      suggestions: candidates.map((candidate) => candidate.suggestion),
    });
  } catch (error) {
    return next(error);
  }
}

function barterCandidate(user, item) {
  const distanceKm = distanceFromUser(user, item);
  return {
    context: {
      kind: 'item',
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      condition: item.condition,
      wantedTitle: item.wantedTitle,
      wantedDescription: item.wantedDescription,
      wantedCategory: item.wantedCategory,
      creditValue: item.creditValue,
      addressLabel: item.addressLabel,
      distanceKm,
    },
    suggestion: {
      kind: 'item',
      id: item.id,
      title: item.title,
      wantedTitle: item.wantedTitle,
      distanceKm,
    },
  };
}

async function match(req, res, next) {
  try {
    const body = req.body;
    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || typeof body.have !== 'string'
      || !body.have.trim()
      || typeof body.want !== 'string'
      || !body.want.trim()
    ) {
      throw createError(400, 'Validation error');
    }
    const extraKeys = Object.keys(body).filter((key) => !['have', 'want', 'category'].includes(key));
    if (extraKeys.length) throw createError(400, 'Validation error');

    const user = await User.findByPk(req.user.id);
    if (!user) throw createError(404, 'Not found');

    const where = { type: 'barter', status: 'available' };
    if (typeof body.category === 'string' && body.category.trim()) {
      where.category = body.category;
    }
    const items = await Item.findAll({ where });
    const pool = items
      .filter((item) => item.latitude != null && item.longitude != null && item.ownerId !== user.id)
      .map((item) => barterCandidate(user, item));
    const candidates = rankBarterCandidates(body.have.trim(), body.want.trim(), pool, MAX_CANDIDATES);

    const reply = await aiService.generateReply({
      message: `Aku punya: ${body.have.trim()}. Aku mau: ${body.want.trim()}. Rekomendasikan listing barter yang cocok dari konteks, sebutkan ID yang ada saja.`,
      candidates: candidates.map((candidate) => candidate.context),
    });

    return res.status(200).json({
      reply,
      suggestions: candidates.map((candidate) => candidate.suggestion),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { chat, match };
