const { getImageKit } = require('../helpers/imagekit');

function authenticationParameters(req, res, next) {
  try {
    const { token, expire, signature } = getImageKit().getAuthenticationParameters();
    return res.status(200).json({ token, expire, signature });
  } catch (error) {
    return next(error);
  }
}

module.exports = { authenticationParameters };
