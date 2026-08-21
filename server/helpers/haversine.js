const EARTH_RADIUS_KM = 6371;
const NEARBY_KM = 10;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const latDistance = toRadians(lat2 - lat1);
  const lngDistance = toRadians(lng2 - lng1);
  const startLat = toRadians(lat1);
  const endLat = toRadians(lat2);

  const haversine = Math.sin(latDistance / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDistance / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));

  return EARTH_RADIUS_KM * 2
    * Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));
}

module.exports = { haversineKm, NEARBY_KM };
