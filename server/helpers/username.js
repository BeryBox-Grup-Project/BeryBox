function sanitizeUsername(baseName) {
  return String(baseName || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16) || 'user';
}

async function uniqueUsername(isTaken, baseName) {
  const cleaned = sanitizeUsername(baseName);
  let candidate = cleaned;
  let suffix = 0;
  while (await isTaken(candidate)) {
    suffix += 1;
    candidate = `${cleaned}${suffix}`.slice(0, 24);
  }
  return candidate;
}

module.exports = { sanitizeUsername, uniqueUsername };
