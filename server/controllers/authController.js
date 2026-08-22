const crypto = require('crypto');
const { User, Organization } = require('../models');
const { comparePassword } = require('../helpers/bcrypt');
const { signToken } = require('../helpers/jwt');
const { verifyGoogleToken } = require('../helpers/google');
const { uniqueUsername } = require('../helpers/username');
const nominatim = require('../helpers/nominatim');

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function organizationSummary(organization) {
  if (!organization) return null;
  return {
    id: organization.id,
    name: organization.name,
    verified: organization.verified,
  };
}

async function userResponse(user) {
  const organization = user.Organization || await Organization.findOne({ where: { userId: user.id } });
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
    status: user.status,
    warningCount: user.warningCount,
    photoUrl: user.photoUrl,
    organization: organizationSummary(organization),
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

    return res.status(201).json(await userResponse(user));
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
    if (user.status === 'banned') throw createError(403, 'Account banned');

    return res.status(201).json(await tokenResponse(user));
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    return res.status(200).json(await userResponse(req.authUser));
  } catch (error) {
    return next(error);
  }
}

async function tokenResponse(user) {
  return {
    access_token: signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    }),
    user: await userResponse(user),
  };
}

async function googleLogin(req, res, next) {
  try {
    const { id_token: idToken, latitude, longitude } = req.body || {};
    const payload = await verifyGoogleToken(idToken);
    const email = payload.email;
    let user = await User.findOne({ where: { email } });

    if (!user) {
      if (typeof latitude !== 'number' || !Number.isFinite(latitude)
        || typeof longitude !== 'number' || !Number.isFinite(longitude)) {
        throw createError(400, 'Validation error');
      }
      const addressLabel = await nominatim.reverse(latitude, longitude);
      const username = await uniqueUsername(
        (candidate) => User.findOne({ where: { username: candidate } }),
        payload.name || email.split('@')[0],
      );
      user = await User.create({
        username,
        email,
        password: crypto.randomBytes(24).toString('hex'),
        role: 'user',
        latitude,
        longitude,
        addressLabel,
      });
    }

    if (user.status === 'banned') throw createError(403, 'Account banned');
    return res.status(201).json(await tokenResponse(user));
  } catch (error) {
    return next(error);
  }
}

async function updateMe(req, res, next) {
  try {
    const allowed = ['username', 'photoUrl', 'latitude', 'longitude'];
    const body = req.body;
    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || !Object.keys(body).length
      || !Object.keys(body).every((field) => allowed.includes(field))
    ) {
      throw createError(400, 'Validation error');
    }

    const changes = {};
    if (body.username !== undefined) {
      if (typeof body.username !== 'string' || !body.username.trim()) {
        throw createError(400, 'Validation error');
      }
      changes.username = body.username.trim();
    }
    if (body.photoUrl !== undefined) {
      if (body.photoUrl !== null && typeof body.photoUrl !== 'string') {
        throw createError(400, 'Validation error');
      }
      changes.photoUrl = body.photoUrl;
    }
    const hasLat = body.latitude !== undefined;
    const hasLng = body.longitude !== undefined;
    if (hasLat !== hasLng) throw createError(400, 'Validation error');
    if (hasLat) {
      if (typeof body.latitude !== 'number' || !Number.isFinite(body.latitude)
        || typeof body.longitude !== 'number' || !Number.isFinite(body.longitude)) {
        throw createError(400, 'Validation error');
      }
      changes.latitude = body.latitude;
      changes.longitude = body.longitude;
      changes.addressLabel = await nominatim.reverse(body.latitude, body.longitude);
    }

    await req.authUser.update(changes);
    return res.status(200).json(await userResponse(req.authUser));
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, me, googleLogin, updateMe };
