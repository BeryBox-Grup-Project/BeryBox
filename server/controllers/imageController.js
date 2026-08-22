const { getImageKit } = require('../helpers/imagekit');

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function authenticationParameters(req, res, next) {
  try {
    const { token, expire, signature } = getImageKit().getAuthenticationParameters();
    return res.status(200).json({ token, expire, signature });
  } catch (error) {
    return next(error);
  }
}

async function upload(req, res, next) {
  try {
    const file = req.body?.file;
    const fileName = req.body?.fileName;
    if (typeof file !== 'string' || !file.trim() || typeof fileName !== 'string' || !fileName.trim()) {
      throw createError(400, 'Validation error');
    }

    const result = await getImageKit().upload({
      file,
      fileName: fileName.trim(),
      folder: '/berybox',
    });
    if (!result?.url) throw createError(502, 'Image upload failed');
    return res.status(200).json({ url: result.url });
  } catch (error) {
    if (error.status) return next(error);
    error.status = 502;
    error.message = 'Image upload failed';
    return next(error);
  }
}

module.exports = { authenticationParameters, upload };
