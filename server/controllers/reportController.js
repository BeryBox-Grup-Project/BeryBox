const { User, Organization, Item, Report } = require('../models');

const TARGET_MODELS = {
  item: Item,
  user: User,
  organization: Organization,
};

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

function reportResponse(report) {
  return {
    id: report.id,
    reporterId: report.reporterId,
    targetType: report.targetType,
    targetId: report.targetId,
    requestId: report.requestId,
    reason: report.reason,
    status: report.status,
  };
}

async function create(req, res, next) {
  try {
    const body = req.body;
    if (
      !(
        hasExactFields(body, ['targetType', 'targetId', 'reason'])
        || hasExactFields(body, ['targetType', 'targetId', 'reason', 'requestId'])
      )
      || !Object.hasOwn(TARGET_MODELS, body.targetType)
      || !Number.isInteger(body.targetId)
      || body.targetId < 1
      || typeof body.reason !== 'string'
      || !body.reason.trim()
      || (body.requestId !== undefined && (!Number.isInteger(body.requestId) || body.requestId < 1))
    ) {
      throw createError(400, 'Validation error');
    }

    const target = await TARGET_MODELS[body.targetType].findByPk(body.targetId);
    if (!target) throw createError(404, 'Not found');

    let requestId = body.requestId ?? null;
    if (requestId) {
      const { Request } = require('../models');
      const related = await Request.findByPk(requestId);
      if (!related) throw createError(404, 'Not found');
    }

    const report = await Report.create({
      reporterId: req.user.id,
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
      status: 'open',
      requestId,
    });
    return res.status(201).json(reportResponse(report));
  } catch (error) {
    return next(error);
  }
}

module.exports = { create };
