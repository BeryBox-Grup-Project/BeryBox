function settleCredit(valueA, valueB) {
  if (valueA === valueB) {
    return { payer: null, receiver: null, amount: 0 };
  }

  return valueA < valueB
    ? { payer: 'A', receiver: 'B', amount: Math.abs(valueA - valueB) }
    : { payer: 'B', receiver: 'A', amount: Math.abs(valueA - valueB) };
}

module.exports = { settleCredit };
