const { User } = require('../models');
const { comparePassword } = require('../helpers/bcrypt');
const { signToken } = require('../helpers/jwt');
const nominatim = require('../helpers/nominatim');

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function userResponse(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    creditBalance: user.creditBalance,
    ratingAvg: user.ratingAvg,
    addressLabel: user.addressLabel,
    latitude: user.latitude,
    longitude: user.longitude,
  };
}

async function register(req, res, next) {
  try {
    const {
      username,
      email,
      password,
      role = 'user',
      latitude,
      longitude,
    } = req.body;

    if (
      typeof username !== 'string'
      || !username.trim()
      || typeof email !== 'string'
      || typeof password !== 'string'
      || password.length < 8
      || !['user', 'organization'].includes(role)
      || typeof latitude !== 'number'
      || !Number.isFinite(latitude)
      || typeof longitude !== 'number'
      || !Number.isFinite(longitude)
    ) {
      throw createError(400, 'Validation error');
    }

    if (await User.findOne({ where: { email } })) {
      throw createError(400, 'Email already registered');
    }

    if (await User.findOne({ where: { username } })) {
      throw createError(400, 'Username already taken');
    }

    const addressLabel = await nominatim.reverse(latitude, longitude);
    const user = await User.create({
      username,
      email,
      password,
      role,
      latitude,
      longitude,
      addressLabel,
    });

    return res.status(201).json(userResponse(user));
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
      throw createError(401, 'Invalid email or password');
    }

    const user = await User.scope('withPassword').findOne({ where: { email } });
    if (!user || !(await comparePassword(password, user.password))) {
      throw createError(401, 'Invalid email or password');
    }

    const accessToken = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return res.status(201).json({
      access_token: accessToken,
      user: userResponse(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    return res.status(200).json(userResponse(req.authUser));
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, me };
