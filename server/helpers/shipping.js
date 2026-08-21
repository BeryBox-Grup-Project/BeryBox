const { NEARBY_KM } = require('./haversine');

const SHIPPING_METHODS = ['pickup', 'courier_agent'];
const COURIER_BASE_FEE = 10000;
const COURIER_PER_KM_FEE = 1500;

function suggestShipping(distanceKm) {
  return distanceKm < NEARBY_KM ? ['pickup', 'courier_agent'] : ['courier_agent'];
}

function shippingFee(method, distanceKm) {
  if (method === 'pickup') return 0;
  if (method !== 'courier_agent') return 0;
  const km = Number.isFinite(distanceKm) ? Math.max(0, Math.round(distanceKm)) : 0;
  return COURIER_BASE_FEE + (km * COURIER_PER_KM_FEE);
}

module.exports = {
  suggestShipping,
  shippingFee,
  SHIPPING_METHODS,
  COURIER_BASE_FEE,
  COURIER_PER_KM_FEE,
};
