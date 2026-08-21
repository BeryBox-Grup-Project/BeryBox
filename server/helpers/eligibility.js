const CONDITIONS = ['new', 'like_new', 'good', 'fair'];
const CATEGORIES = ['clothes', 'books', 'electronics', 'furniture', 'toys', 'kitchen', 'other'];
const BANNED_KEYWORDS = [
  'obat',
  'medicine',
  'senjata',
  'weapon',
  'expired',
  'kadaluarsa',
  'narkoba',
  'underwear',
  'pakaian dalam',
];
const INELIGIBLE_MESSAGE = 'Item does not meet donation standards';

function isItemEligible({ condition, category, description }) {
  const normalizedDescription = typeof description === 'string' ? description.toLowerCase() : '';
  const eligible = CONDITIONS.includes(condition)
    && CATEGORIES.includes(category)
    && typeof description === 'string'
    && description.trim().length >= 1
    && !BANNED_KEYWORDS.some((keyword) => normalizedDescription.includes(keyword));

  return {
    eligible,
    message: eligible ? '' : INELIGIBLE_MESSAGE,
  };
}

module.exports = { isItemEligible };
