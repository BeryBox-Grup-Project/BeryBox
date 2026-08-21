const { NEARBY_KM } = require('./haversine');

function suggestShipping(distanceKm) {
  return distanceKm < NEARBY_KM ? ['pickup', 'gosend'] : ['jne', 'jnt'];
}

module.exports = { suggestShipping };
