function parsePagination(query = {}) {
  const rawPage = query.page;
  const rawLimit = query.limit;
  const page = rawPage === undefined || rawPage === '' ? 1 : Number(rawPage);
  const limit = rawLimit === undefined || rawLimit === '' ? 12 : Number(rawLimit);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    const error = new Error('Validation error');
    error.status = 400;
    throw error;
  }

  return { page, limit };
}

function searchTerm(queryValue) {
  if (typeof queryValue !== 'string') return '';
  return queryValue.trim();
}

function paginateArray(items, page, limit) {
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

module.exports = {
  parsePagination,
  searchTerm,
  paginateArray,
};
