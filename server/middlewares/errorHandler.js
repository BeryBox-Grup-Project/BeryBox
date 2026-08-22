function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const origin = req.headers?.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept');

  let status = Number.isInteger(error.status) ? error.status : 500;
  let message = error.message;

  if (error instanceof SyntaxError && error.type === 'entity.parse.failed') {
    status = 400;
    message = 'Validation error';
  } else if (error.name === 'SequelizeValidationError') {
    status = 400;
    message = 'Validation error';
  } else if (error.name === 'SequelizeUniqueConstraintError') {
    status = 400;
    if (error.fields && Object.hasOwn(error.fields, 'email')) {
      message = 'Email already registered';
    } else if (error.fields && Object.hasOwn(error.fields, 'username')) {
      message = 'Username already taken';
    } else {
      message = 'Validation error';
    }
  } else if (status === 500) {
    message = 'Internal server error';
  }

  return res.status(status).json({
    message: message || 'Internal server error',
  });
}

module.exports = errorHandler;
