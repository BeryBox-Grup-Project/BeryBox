const { Op } = require('sequelize');
const { Organization, Request } = require('../models');
const { haversineKm } = require('../helpers/haversine');
const { suggestShipping } = require('../helpers/shipping');
const { stripCoordinates } = require('../helpers/geoPrivacy');
const nominatim = require('../helpers/nominatim');

const ORGANIZATION_TYPES = ['orphanage', 'volunteer', 'community', 'other'];
const CREATE_FIELDS = ['name', 'type', 'description', 'latitude', 'longitude'];

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
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

function organizationDistance(organization, coordinates) {
  if (!coordinates || organization.latitude == null || organization.longitude == null) {
    return undefined;
  }
  return Number(haversineKm(
    coordinates.latitude,
    coordinates.longitude,
    organization.latitude,
    organization.longitude,
  ).toFixed(1));
}

function publicOrganizationResponse(organization, coordinates, includeCoordinates = false) {
  const response = {
    id: organization.id,
    userId: organization.userId,
    name: organization.name,
    type: organization.type,
    description: organization.description,
    verified: organization.verified,
    addressLabel: organization.addressLabel,
  };
  const distanceKm = organizationDistance(organization, coordinates);
  if (distanceKm !== undefined) response.distanceKm = distanceKm;
  if (includeCoordinates) {
    response.latitude = organization.latitude;
    response.longitude = organization.longitude;
  }
  return includeCoordinates ? response : stripCoordinates(response);
}

function createdOrganizationResponse(organization) {
  return {
    id: organization.id,
    userId: organization.userId,
    name: organization.name,
    type: organization.type,
    description: organization.description,
    verified: organization.verified,
    latitude: organization.latitude,
    longitude: organization.longitude,
    addressLabel: organization.addressLabel,
  };
}

async function list(req, res, next) {
  try {
    const coordinates = req.query.lat !== undefined && req.query.lng !== undefined
      ? parseCoordinates(req.query.lat, req.query.lng)
      : null;
    const organizations = await Organization.findAll({
      where: { verified: 'approved' },
      order: [['createdAt', 'DESC']],
    });
    const response = organizations.map((organization) => (
      publicOrganizationResponse(organization, coordinates)
    ));
    if (coordinates) response.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
}

async function canViewCoordinates(userId, organization) {
  const acceptedRequest = await Request.findOne({
    where: {
      type: 'org_offer',
      toUserId: organization.userId,
      status: { [Op.in]: ['accepted', 'completed'] },
      [Op.or]: [{ fromUserId: userId }, { toUserId: userId }],
    },
  });
  return Boolean(acceptedRequest);
}

async function detail(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw createError(404, 'Not found');
    const organization = await Organization.findOne({ where: { id, verified: 'approved' } });
    if (!organization) throw createError(404, 'Not found');

    const coordinates = req.query.lat !== undefined && req.query.lng !== undefined
      ? parseCoordinates(req.query.lat, req.query.lng)
      : null;
    const includeCoordinates = await canViewCoordinates(req.user.id, organization);
    const response = publicOrganizationResponse(
      organization,
      coordinates,
      includeCoordinates,
    );
    response.suggestedShipping = coordinates && response.distanceKm !== undefined
      ? suggestShipping(response.distanceKm)
      : [];
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const body = req.body;
    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || !Object.keys(body).every((field) => CREATE_FIELDS.includes(field))
      || typeof body.name !== 'string'
      || !body.name.trim()
      || !ORGANIZATION_TYPES.includes(body.type)
      || typeof body.description !== 'string'
      || body.description.length < 20
      || typeof body.latitude !== 'number'
      || !Number.isFinite(body.latitude)
      || typeof body.longitude !== 'number'
      || !Number.isFinite(body.longitude)
    ) {
      throw createError(400, 'Validation error');
    }

    const existing = await Organization.findOne({ where: { userId: req.user.id } });
    if (existing) throw createError(400, 'Organization already exists');

    const addressLabel = await nominatim.reverse(body.latitude, body.longitude);
    const organization = await Organization.create({
      userId: req.user.id,
      name: body.name,
      type: body.type,
      description: body.description,
      verified: 'pending',
      latitude: body.latitude,
      longitude: body.longitude,
      addressLabel,
    });
    return res.status(201).json(createdOrganizationResponse(organization));
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(createError(400, 'Organization already exists'));
    }
    return next(error);
  }
}

module.exports = { list, detail, create };
