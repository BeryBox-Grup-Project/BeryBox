const { User } = require('../models');

async function detail(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      const error = new Error('Not found');
      error.status = 404;
      throw error;
    }

    const user = await User.findByPk(id);
    if (!user) {
      const error = new Error('Not found');
      error.status = 404;
      throw error;
    }
    return res.status(200).json({
      id: user.id,
      username: user.username,
      role: user.role,
      ratingAvg: user.ratingAvg,
      addressLabel: user.addressLabel,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { detail };
