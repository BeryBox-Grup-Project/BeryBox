function adminAuthorization(req, res, next) {
  if (req.user.role !== 'admin') {
    const error = new Error('Admin access required');
    error.status = 403;
    return next(error);
  }

  return next();
}

function organizationAuthorization(req, res, next) {
  if (req.user.role !== 'organization') {
    const error = new Error('Forbidden');
    error.status = 403;
    return next(error);
  }

  return next();
}

async function itemOwnerAuthorization(req, res, next) {
  try {
    const { Item } = require('../models');
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      const error = new Error('Not found');
      error.status = 404;
      return next(error);
    }

    const item = await Item.findByPk(id);
    if (!item) {
      const error = new Error('Not found');
      error.status = 404;
      return next(error);
    }
    if (item.ownerId !== req.user.id || item.status !== 'available') {
      const error = new Error('Forbidden');
      error.status = 403;
      return next(error);
    }

    req.item = item;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  adminAuthorization,
  organizationAuthorization,
  itemOwnerAuthorization,
};
