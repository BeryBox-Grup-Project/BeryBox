const { User } = require('../models');
const { verifyToken } = require('../helpers/jwt');

async function authentication(req, res, next) {
  try {
    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string') throw new Error('Invalid token');

    const parts = authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw new Error('Invalid token');
    }

    const payload = verifyToken(parts[1]);
    const user = await User.findByPk(payload.id);
    if (!user) throw new Error('Invalid token');

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    req.authUser = user;
    return next();
  } catch {
    const error = new Error('Invalid token');
    error.status = 401;
    return next(error);
  }
}

module.exports = authentication;
