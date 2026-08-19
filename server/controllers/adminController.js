const { Organization, Report } = require('../models');

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
    const results = await Organization.findAll({ order: [['createdAt', 'DESC']] });
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
    await organization.update({ verified: req.body.verified });
    return res.status(200).json(organization);
  } catch (error) {
    return next(error);
  }
}

async function reports(req, res, next) {
  try {
    const { status } = req.query;
    if (status !== undefined && !['open', 'resolved'].includes(status)) {
      throw createError(400, 'Validation error');
    }
    const where = status ? { status } : {};
    const results = await Report.findAll({ where, order: [['createdAt', 'DESC']] });
    return res.status(200).json(results);
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

module.exports = {
  organizations,
  verifyOrganization,
  reports,
  resolveReport,
};
