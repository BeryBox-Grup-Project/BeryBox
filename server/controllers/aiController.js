const { User, Organization, Item } = require('../models');
const { haversineKm } = require('../helpers/haversine');
const geminiService = require('../services/geminiService');

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

function organizationCandidate(user, organization) {
  const distanceKm = distanceFromUser(user, organization);
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

function itemCandidate(user, item) {
  const distanceKm = distanceFromUser(user, item);
  return {
    context: {
      kind: 'item',
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      condition: item.condition,
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
      || Object.keys(body).length !== 1
      || !Object.hasOwn(body, 'message')
      || typeof body.message !== 'string'
      || !body.message.trim()
    ) {
      throw createError(400, 'Validation error');
    }

    const user = await User.findByPk(req.user.id);
    if (!user) throw createError(404, 'Not found');
    const [organizations, items] = await Promise.all([
      Organization.findAll({
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
      }),
      Item.findAll({
        where: { type: 'public', status: 'available' },
        attributes: [
          'id',
          'title',
          'description',
          'category',
          'condition',
          'addressLabel',
          'latitude',
          'longitude',
        ],
      }),
    ]);

    const candidates = [
      ...organizations
        .filter((organization) => organization.latitude != null && organization.longitude != null)
        .map((organization) => organizationCandidate(user, organization)),
      ...items
        .filter((item) => item.latitude != null && item.longitude != null)
        .map((item) => itemCandidate(user, item)),
    ]
      .sort((a, b) => a.suggestion.distanceKm - b.suggestion.distanceKm)
      .slice(0, MAX_CANDIDATES);

    let reply;
    try {
      reply = await geminiService.generateReply({
        message: body.message.trim(),
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

module.exports = { chat };
