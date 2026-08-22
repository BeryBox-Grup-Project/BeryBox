const { Op } = require('sequelize');
const { Notification } = require('../models');
const { notificationResponse } = require('../services/notificationService');

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function list(req, res, next) {
  try {
    const rows = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json(rows.map(notificationResponse));
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw createError(404, 'Not found');
    const row = await Notification.findByPk(id);
    if (!row) throw createError(404, 'Not found');
    if (row.userId !== req.user.id) throw createError(403, 'Forbidden');
    if (!row.readAt) await row.update({ readAt: new Date() });
    return res.status(200).json(notificationResponse(row));
  } catch (error) {
    return next(error);
  }
}

async function markReadAll(req, res, next) {
  try {
    const scope = req.body?.scope;
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.keys(req.body).join() !== 'scope'
      || !['inbox', 'activity'].includes(scope)) {
      throw createError(400, 'Validation error');
    }
    const where = { userId: req.user.id, readAt: null };
    if (scope === 'inbox') where.type = 'message';
    else where.type = { [Op.ne]: 'message' };
    await Notification.update({ readAt: new Date() }, { where });
    const rows = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json(rows.map(notificationResponse));
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, markRead, markReadAll };
