function stripCoordinates(itemOrUser) {
  const value = typeof itemOrUser.toJSON === 'function' ? itemOrUser.toJSON() : itemOrUser;
  const { latitude, longitude, ...withoutCoordinates } = value;
  return withoutCoordinates;
}

module.exports = { stripCoordinates };
