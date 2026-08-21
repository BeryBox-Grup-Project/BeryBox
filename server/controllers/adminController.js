const { Op } = require('sequelize');
const { User, Organization, Item, Request, Report, Review } = require('../models');
const { notify } = require('../services/notificationService');
const aiService = require('../services/aiService');
const { haversineKm } = require('../helpers/haversine');
const { isImageKitUrl } = require('../helpers/imagekit');
const nominatim = require('../helpers/nominatim');
const { searchTerm } = require('../helpers/pagination');

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hasExactFields(body, fields) {
  return body
    && typeof body === 'object'
    && !Array.isArray(body)
    && Object.keys(body).length === fields.length
    && Object.keys(body).every((field) => fields.includes(field));
}

async function organizations(req, res, next) {
  try {
    const term = searchTerm(req.query.q);
    const where = {};
    if (term) {
      const like = { [Op.iLike]: `%${term}%` };
      where[Op.or] = [
        { name: like },
        { description: like },
        { addressLabel: like },
        { email: like },
        { phone: like },
      ];
    }
    const results = await Organization.findAll({ where, order: [['createdAt', 'DESC']] });
    return res.status(200).json(results);
  } catch (error) {
    return next(error);
  }
}

async function verifyOrganization(req, res, next) {
  try {
    if (!hasExactFields(req.body, ['verified']) || !['approved', 'rejected'].includes(req.body.verified)) {
      throw createError(400, 'Validation error');
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw createError(404, 'Not found');

    const organization = await Organization.findByPk(id);
    if (!organization) throw createError(404, 'Not found');

    const previousUserId = organization.userId;
    const updates = { verified: req.body.verified };
    if (req.body.verified === 'rejected') {
      updates.userId = null;
      if (organization.source !== 'manual') updates.verified = 'unverified';
    }
    await organization.update(updates);

    if (previousUserId) {
      await notify(previousUserId, {
        type: req.body.verified === 'approved' ? 'accepted' : 'rejected',
        requestId: null,
        conversationId: null,
        message: req.body.verified === 'approved'
          ? 'Your organization was approved'
          : 'Your organization claim was rejected',
      });
    }

    return res.status(200).json(organization);
  } catch (error) {
    return next(error);
  }
}

const ORGANIZATION_TYPES = ['orphanage', 'volunteer', 'community', 'other'];
const ORGANIZATION_CREATE_FIELDS = [
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

function optionalOrgString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim() || null;
}

async function createOrganization(req, res, next) {
  try {
    const body = req.body;
    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || !Object.keys(body).every((field) => ORGANIZATION_CREATE_FIELDS.includes(field))
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

    const email = optionalOrgString(body.email);
    const phone = optionalOrgString(body.phone);
    const website = optionalOrgString(body.website);
    const photoUrl = optionalOrgString(body.photoUrl);
    if (email === undefined || phone === undefined || website === undefined || photoUrl === undefined) {
      throw createError(400, 'Validation error');
    }
    if (photoUrl && !isImageKitUrl(photoUrl)) throw createError(400, 'Invalid image url');
    const galleryUrls = body.galleryUrls === undefined ? [] : body.galleryUrls;
    if (!Array.isArray(galleryUrls) || galleryUrls.some((url) => !isImageKitUrl(url))) {
      throw createError(400, 'Validation error');
    }

    const addressLabel = await nominatim.reverse(body.latitude, body.longitude);
    const organization = await Organization.create({
      userId: null,
      name: body.name.trim(),
      type: body.type,
      description: body.description,
      verified: 'approved',
      source: 'manual',
      latitude: body.latitude,
      longitude: body.longitude,
      addressLabel,
      email,
      phone,
      website,
      photoUrl,
      galleryUrls,
    });
    return res.status(201).json(organization);
  } catch (error) {
    return next(error);
  }
}

async function countDistinctReporters(targetType, targetId) {
  return Report.count({
    where: { targetType, targetId },
    distinct: true,
    col: 'reporterId',
  });
}

async function subjectForReport(report) {
  if (report.targetType === 'user') {
    const user = await User.findByPk(report.targetId, {
      attributes: ['id', 'username', 'status', 'warningCount', 'role'],
    });
    return { target: user ? {
      type: 'user',
      id: user.id,
      username: user.username,
      status: user.status,
      warningCount: user.warningCount,
    } : null, subjectUser: user && user.role !== 'admin' ? {
      id: user.id,
      username: user.username,
      status: user.status,
      warningCount: user.warningCount,
    } : null };
  }

  if (report.targetType === 'item') {
    const item = await Item.findByPk(report.targetId, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'status', 'warningCount', 'role'] }],
    });
    if (!item) return { target: null, subjectUser: null };
    const owner = item.owner && item.owner.role !== 'admin' ? {
      id: item.owner.id,
      username: item.owner.username,
      status: item.owner.status,
      warningCount: item.owner.warningCount,
    } : null;
    return {
      target: {
        type: 'item',
        id: item.id,
        title: item.title,
        status: item.status,
        ownerId: item.ownerId,
      },
      subjectUser: owner,
    };
  }

  const organization = await Organization.findByPk(report.targetId);
  if (!organization) return { target: null, subjectUser: null };
  const owner = organization.userId
    ? await User.findByPk(organization.userId, {
      attributes: ['id', 'username', 'status', 'warningCount', 'role'],
    })
    : null;
  return {
    target: {
      type: 'organization',
      id: organization.id,
      name: organization.name,
      verified: organization.verified,
      userId: organization.userId,
    },
    subjectUser: owner && owner.role !== 'admin' ? {
      id: owner.id,
      username: owner.username,
      status: owner.status,
      warningCount: owner.warningCount,
    } : null,
  };
}

async function decorateReport(report) {
  const json = report.toJSON();
  const [distinctReporterCount, subject] = await Promise.all([
    countDistinctReporters(report.targetType, report.targetId),
    subjectForReport(report),
  ]);
  return {
    ...json,
    target: subject.target,
    subjectUser: subject.subjectUser,
    distinctReporterCount,
    repeatOffense: distinctReporterCount >= 2,
  };
}

function reportSearchHaystack(report) {
  return [
    report.reason,
    report.targetType,
    report.reporter?.username,
    report.reporter?.email,
    report.target?.title,
    report.target?.name,
    report.target?.username,
    report.subjectUser?.username,
  ].filter(Boolean).join(' ').toLowerCase();
}

async function reports(req, res, next) {
  try {
    const { status } = req.query;
    if (status !== undefined && !['open', 'resolved'].includes(status)) {
      throw createError(400, 'Validation error');
    }
    const where = status ? { status } : {};
    const results = await Report.findAll({
      where,
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'username', 'email', 'status', 'warningCount'] },
        { model: Request },
      ],
      order: [['createdAt', 'DESC']],
    });
    const decorated = await Promise.all(results.map(decorateReport));
    const term = searchTerm(req.query.q).toLowerCase();
    const filtered = term
      ? decorated.filter((report) => reportSearchHaystack(report).includes(term))
      : decorated;
    return res.status(200).json(filtered);
  } catch (error) {
    return next(error);
  }
}

async function resolveReport(req, res, next) {
  try {
    if (!hasExactFields(req.body, ['status']) || req.body.status !== 'resolved') {
      throw createError(400, 'Validation error');
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw createError(404, 'Not found');

    const report = await Report.findByPk(id);
    if (!report) throw createError(404, 'Not found');
    await report.update({ status: 'resolved' });
    return res.status(200).json(report);
  } catch (error) {
    return next(error);
  }
}

async function stats(req, res, next) {
  try {
    const [
      users,
      items,
      requests,
      organizationsCount,
      openReports,
      completedRequests,
    ] = await Promise.all([
      User.count(),
      Item.count(),
      Request.count(),
      Organization.count(),
      Report.count({ where: { status: 'open' } }),
      Request.count({ where: { status: 'completed' } }),
    ]);
    return res.status(200).json({
      users,
      items,
      requests,
      organizations: organizationsCount,
      openReports,
      completedRequests,
    });
  } catch (error) {
    return next(error);
  }
}

async function hideBannedUserListings(userId) {
  await Item.update(
    { status: 'cancelled' },
    { where: { ownerId: userId, status: 'available' } },
  );
}

async function warnUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw createError(404, 'Not found');
    const user = await User.findByPk(id);
    if (!user) throw createError(404, 'Not found');
    if (user.role === 'admin') throw createError(403, 'Forbidden');
    if (user.status === 'banned') throw createError(400, 'Validation error');

    const warningCount = user.warningCount + 1;
    const status = warningCount >= 2 ? 'banned' : 'warned';
    await user.update({ warningCount, status });
    if (status === 'banned') await hideBannedUserListings(user.id);
    await notify(user.id, {
      type: status === 'banned' ? 'banned' : 'warning',
      requestId: null,
      conversationId: null,
      message: status === 'banned'
        ? 'Your account was banned after repeated reports'
        : 'You received a warning from BeryBox moderators',
    });
    return res.status(200).json({
      id: user.id,
      username: user.username,
      status: user.status,
      warningCount: user.warningCount,
    });
  } catch (error) {
    return next(error);
  }
}

async function banUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw createError(404, 'Not found');
    const user = await User.findByPk(id);
    if (!user) throw createError(404, 'Not found');
    if (user.role === 'admin') throw createError(403, 'Forbidden');
    await user.update({ status: 'banned' });
    await hideBannedUserListings(user.id);
    await notify(user.id, {
      type: 'banned',
      requestId: null,
      conversationId: null,
      message: 'Your account was banned',
    });
    return res.status(200).json({
      id: user.id,
      username: user.username,
      status: user.status,
      warningCount: user.warningCount,
    });
  } catch (error) {
    return next(error);
  }
}

async function removeItem(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw createError(404, 'Not found');
    const item = await Item.findByPk(id);
    if (!item) throw createError(404, 'Not found');
    if (item.status === 'cancelled') throw createError(400, 'Validation error');

    const distinctReporterCount = await countDistinctReporters('item', item.id);
    if (distinctReporterCount < 2) throw createError(400, 'Validation error');

    await item.update({ status: 'cancelled' });
    await Report.update(
      { status: 'resolved' },
      { where: { targetType: 'item', targetId: item.id, status: 'open' } },
    );
    await notify(item.ownerId, {
      type: 'warning',
      requestId: null,
      conversationId: null,
      message: 'Your item was removed after repeated reports',
    });
    return res.status(200).json({
      id: item.id,
      status: item.status,
    });
  } catch (error) {
    return next(error);
  }
}

async function researchOrganization(req, res, next) {
  try {
    if (
      !req.body
      || typeof req.body !== 'object'
      || Array.isArray(req.body)
      || !Object.keys(req.body).every((field) => field === 'organizationId' || field === 'message')
      || !Number.isInteger(req.body.organizationId)
    ) {
      throw createError(400, 'Validation error');
    }
    const organization = await Organization.findByPk(req.body.organizationId);
    if (!organization) throw createError(404, 'Not found');

    const distanceKm = req.authUser
      ? Number(haversineKm(
        req.authUser.latitude,
        req.authUser.longitude,
        organization.latitude,
        organization.longitude,
      ).toFixed(1))
      : null;
    const context = [{
      kind: 'organization',
      id: organization.id,
      name: organization.name,
      description: organization.description,
      type: organization.type,
      verified: organization.verified,
      source: organization.source,
      website: organization.website,
      phone: organization.phone,
      email: organization.email,
      addressLabel: organization.addressLabel,
      claimed: Boolean(organization.userId),
      distanceKm,
    }];
    const message = typeof req.body.message === 'string' && req.body.message.trim()
      ? req.body.message.trim()
      : `Research this organization for verification: ${organization.name}`;

    let reply;
    try {
      reply = await aiService.generateReply({ message, candidates: context });
    } catch {
      throw createError(502, 'AI service unavailable');
    }
    return res.status(200).json({
      reply,
      suggestions: [{
        kind: 'organization',
        id: organization.id,
        name: organization.name,
        distanceKm,
      }],
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  organizations,
  createOrganization,
  verifyOrganization,
  reports,
  resolveReport,
  stats,
  warnUser,
  banUser,
  removeItem,
  researchOrganization,
};
