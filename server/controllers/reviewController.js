const { fn, col } = require('sequelize');
const { sequelize, User, Request, Review } = require('../models');

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

function reviewResponse(review) {
  return {
    id: review.id,
    requestId: review.requestId,
    fromUserId: review.fromUserId,
    toUserId: review.toUserId,
    rating: review.rating,
    comment: review.comment,
  };
}

async function create(req, res, next) {
  let transaction;
  try {
    const body = req.body;
    if (
      !hasExactFields(body, ['requestId', 'rating', 'comment'])
      || !Number.isInteger(body.requestId)
      || body.requestId < 1
      || !Number.isInteger(body.rating)
      || body.rating < 1
      || body.rating > 5
      || typeof body.comment !== 'string'
      || !body.comment.trim()
    ) {
      throw createError(400, 'Validation error');
    }

    transaction = await sequelize.transaction();
    const request = await Request.findByPk(body.requestId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!request) throw createError(404, 'Not found');
    if (![request.fromUserId, request.toUserId].includes(req.user.id)) {
      throw createError(403, 'Forbidden');
    }
    if (request.status !== 'completed') throw createError(400, 'Validation error');

    const toUserId = req.user.id === request.fromUserId
      ? request.toUserId
      : request.fromUserId;
    const targetUser = await User.findByPk(toUserId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!targetUser) throw createError(404, 'Not found');

    const duplicate = await Review.findOne({
      where: { requestId: request.id, fromUserId: req.user.id },
      transaction,
    });
    if (duplicate) throw createError(400, 'Validation error');

    const review = await Review.create({
      requestId: request.id,
      fromUserId: req.user.id,
      toUserId,
      rating: body.rating,
      comment: body.comment,
    }, { transaction });
    const aggregate = await Review.findOne({
      attributes: [[fn('AVG', col('rating')), 'ratingAvg']],
      where: { toUserId },
      raw: true,
      transaction,
    });
    await targetUser.update({ ratingAvg: Number(aggregate.ratingAvg) }, { transaction });

    await transaction.commit();
    return res.status(201).json(reviewResponse(review));
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(createError(400, 'Validation error'));
    }
    return next(error);
  }
}

async function listForUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw createError(404, 'Not found');
    const user = await User.findByPk(id);
    if (!user) throw createError(404, 'Not found');
    const reviews = await Review.findAll({
      where: { toUserId: id },
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json(reviews.map(reviewResponse));
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, listForUser };
