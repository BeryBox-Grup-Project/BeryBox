const { Op } = require('sequelize');
const { Organization, User } = require('../models');
const { haversineKm } = require('../helpers/haversine');
const { suggestShipping } = require('../helpers/shipping');
const { parsePagination, searchTerm, paginateArray } = require('../helpers/pagination');
const { isImageKitUrl } = require('../helpers/imagekit');
const nominatim = require('../helpers/nominatim');
const places = require('../helpers/places');
const { raceWithTimeout } = require('../helpers/timeout');

const ORGANIZATION_TYPES = ['orphanage', 'volunteer', 'community', 'other'];
const CREATE_FIELDS = [
  'name',
  'type',
  'description',
  'latitude',
  'longitude',
  'email',
  'phone',
  'website',
  'photoUrl',
  'galleryUrls',
];
const VISIBLE_VERIFIED = ['unverified', 'pending', 'approved'];

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

function offerChannel(organization) {
  if (organization.userId) return 'inbox';
  if (organization.email) return 'email';
  if (organization.phone) return 'phone';
  if (organization.website) return 'website';
  return 'none';
}

function publicOrganizationResponse(organization, coordinates) {
  const response = {
    id: organization.id,
    userId: organization.userId,
    name: organization.name,
    type: organization.type,
    description: organization.description,
    verified: organization.verified,
    source: organization.source,
    googlePlaceId: organization.googlePlaceId,
    addressLabel: organization.addressLabel,
    photoUrl: organization.photoUrl,
    galleryUrls: organization.galleryUrls || [],
    website: organization.website,
    phone: organization.phone,
    email: organization.email,
    claimed: Boolean(organization.userId),
    offerChannel: offerChannel(organization),
    latitude: organization.latitude,
    longitude: organization.longitude,
  };
  const distanceKm = organizationDistance(organization, coordinates);
  if (distanceKm !== undefined) response.distanceKm = distanceKm;
  return response;
}

function createdOrganizationResponse(organization) {
  return publicOrganizationResponse(organization, null);
}

async function upsertPlaces(coordinates) {
  if (!places.isConfigured() || !coordinates) return;
  const nearby = await places.fetchNearby(coordinates);
  await Promise.all(nearby.map(async (place) => {
    const existing = await Organization.findOne({ where: { googlePlaceId: place.googlePlaceId } });
    if (existing) {
      await existing.update({
        name: place.name,
        addressLabel: place.addressLabel,
        latitude: place.latitude,
        longitude: place.longitude,
        photoUrl: existing.photoUrl || place.photoUrl,
        galleryUrls: existing.galleryUrls?.length ? existing.galleryUrls : place.galleryUrls,
      });
      return;
    }
    await Organization.create({
      userId: null,
      ...place,
    });
  }));
}

const PLACE_SYNC_TTL_MS = 10 * 60 * 1000;
const placeSyncAt = new Map();

function placesCacheKey(coordinates) {
  return `${coordinates.latitude.toFixed(2)}:${coordinates.longitude.toFixed(2)}`;
}

function syncPlaces(coordinates) {
  if (!places.isConfigured() || !coordinates) return Promise.resolve();
  if (process.env.NODE_ENV === 'test') {
    return upsertPlaces(coordinates).catch(() => {});
  }
  const key = placesCacheKey(coordinates);
  const last = placeSyncAt.get(key) || 0;
  if (Date.now() - last < PLACE_SYNC_TTL_MS) return Promise.resolve();
  placeSyncAt.set(key, Date.now());
  return upsertPlaces(coordinates).catch(() => {
    placeSyncAt.delete(key);
  });
}

async function list(req, res, next) {
  try {
    const { q, type, sort } = req.query;
    if (type && !ORGANIZATION_TYPES.includes(type)) {
      throw createError(400, 'Validation error');
    }
    if (sort !== undefined && !['newest', 'oldest', 'nearby'].includes(sort)) {
      throw createError(400, 'Validation error');
    }

    const { page, limit } = parsePagination(req.query);
    const coordinates = req.query.lat !== undefined && req.query.lng !== undefined
      ? parseCoordinates(req.query.lat, req.query.lng)
      : null;
    if (coordinates) {
      const syncing = syncPlaces(coordinates);
      if (process.env.NODE_ENV === 'test') await syncing;
    }

    const where = { verified: { [Op.in]: VISIBLE_VERIFIED } };
    if (type) where.type = type;
    const term = searchTerm(q);
    if (term) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${term}%` } },
        { description: { [Op.iLike]: `%${term}%` } },
      ];
    }

    const organizations = await Organization.findAll({
      where,
      include: [{ model: User, required: false, attributes: ['id', 'status'] }],
      order: [['createdAt', sort === 'oldest' ? 'ASC' : 'DESC']],
    });
    const visibleOrganizations = organizations.filter((organization) => (
      !organization.User || organization.User.status !== 'banned'
    ));
    const response = visibleOrganizations.map((organization) => (
      publicOrganizationResponse(organization, coordinates)
    ));
    if (coordinates && (sort === 'nearby' || !sort)) {
      response.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    return res.status(200).json(paginateArray(response, page, limit));
  } catch (error) {
    return next(error);
  }
}

async function detail(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw createError(404, 'Not found');
    const organization = await Organization.findOne({
      where: { id, verified: { [Op.in]: VISIBLE_VERIFIED } },
      include: [{ model: User, required: false, attributes: ['id', 'status'] }],
    });
    if (!organization || organization.User?.status === 'banned') throw createError(404, 'Not found');

    if (organization.googlePlaceId && places.isConfigured() && !organization.phone && !organization.website) {
      try {
        const details = await raceWithTimeout(
          places.fetchDetails(organization.googlePlaceId),
          1200,
          'details timeout',
        );
        if (details) {
          await organization.update({
            phone: details.phone,
            website: details.website,
            addressLabel: details.addressLabel || organization.addressLabel,
            galleryUrls: details.galleryUrls?.length ? details.galleryUrls : organization.galleryUrls,
            photoUrl: organization.photoUrl || details.photoUrl,
          });
        }
      } catch {
        // Detail enrichment is optional.
      }
    }

    const coordinates = req.query.lat !== undefined && req.query.lng !== undefined
      ? parseCoordinates(req.query.lat, req.query.lng)
      : null;
    const response = publicOrganizationResponse(organization, coordinates);
    response.suggestedShipping = coordinates && response.distanceKm !== undefined
      ? suggestShipping(response.distanceKm)
      : [];
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
}

function optionalString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim() || null;
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
      || !body.description.trim()
      || typeof body.latitude !== 'number'
      || !Number.isFinite(body.latitude)
      || typeof body.longitude !== 'number'
      || !Number.isFinite(body.longitude)
    ) {
      throw createError(400, 'Validation error');
    }

    const email = optionalString(body.email);
    const phone = optionalString(body.phone);
    const website = optionalString(body.website);
    const photoUrl = optionalString(body.photoUrl);
    if (email === undefined || phone === undefined || website === undefined || photoUrl === undefined) {
      throw createError(400, 'Validation error');
    }
    if (photoUrl && !isImageKitUrl(photoUrl)) throw createError(400, 'Invalid image url');
    const galleryUrls = body.galleryUrls === undefined ? [] : body.galleryUrls;
    if (!Array.isArray(galleryUrls) || galleryUrls.some((url) => !isImageKitUrl(url))) {
      throw createError(400, 'Validation error');
    }

    const existing = await Organization.findOne({ where: { userId: req.user.id } });
    if (existing && existing.verified !== 'rejected') {
      throw createError(400, 'Organization already exists');
    }

    const addressLabel = await nominatim.reverse(body.latitude, body.longitude);
    const payload = {
      userId: req.user.id,
      name: body.name,
      type: body.type,
      description: body.description,
      verified: 'pending',
      source: 'manual',
      latitude: body.latitude,
      longitude: body.longitude,
      addressLabel,
      email,
      phone,
      website,
      photoUrl,
      galleryUrls,
    };
    if (existing) {
      await existing.update(payload);
      return res.status(200).json(createdOrganizationResponse(existing));
    }
    const organization = await Organization.create(payload);
    return res.status(201).json(createdOrganizationResponse(organization));
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(createError(400, 'Organization already exists'));
    }
    return next(error);
  }
}

async function claim(req, res, next) {
  try {
    if (
      !req.body
      || typeof req.body !== 'object'
      || Array.isArray(req.body)
      || !Object.keys(req.body).every((field) => field === 'googlePlaceId')
      || typeof req.body.googlePlaceId !== 'string'
      || !req.body.googlePlaceId.trim()
    ) {
      throw createError(400, 'Validation error');
    }

    const existing = await Organization.findOne({ where: { userId: req.user.id } });
    if (existing) throw createError(400, 'Organization already exists');

    let organization = await Organization.findOne({
      where: { googlePlaceId: req.body.googlePlaceId.trim() },
    });
    if (!organization && places.isConfigured()) {
      const details = await places.fetchDetails(req.body.googlePlaceId.trim());
      if (details) organization = await Organization.create({ userId: null, ...details });
    }
    if (!organization) throw createError(404, 'Not found');
    if (organization.userId && organization.userId !== req.user.id) {
      throw createError(400, 'Organization already exists');
    }

    await organization.update({
      userId: req.user.id,
      verified: organization.verified === 'approved' ? 'approved' : 'pending',
    });
    return res.status(200).json(createdOrganizationResponse(organization));
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(createError(400, 'Organization already exists'));
    }
    return next(error);
  }
}

async function photo(_req, _res, next) {
  return next(createError(404, 'Not found'));
}

module.exports = { list, detail, create, claim, photo };
