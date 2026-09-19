/** Signed degrees-and-decimal-minutes to decimal degrees. */
export const decodeCoordinate = n => Math.trunc(n / 100) + (n - Math.trunc(n / 100) * 100) / 60;

/** Decimal degrees to numeric DDMM notation, carrying rounded minutes. */
export function encodeCoordinate(n) {
  let degrees = Math.trunc(n), minutes = (n - degrees) * 60;
  let raw = degrees * 100 + minutes;
  if (Math.abs(raw % 100) >= 60) {
    degrees += Math.sign(n); minutes = 0; raw = degrees * 100;
  }
  return raw;
}

/** Direct comparisons avoid normalized-floor errors at fractional boundaries. */
export function axisIndex(n, min, max) {
  let low = 0, high = 60;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (n < min + (max - min) * middle / 60) high = middle;
    else low = middle;
  }
  return low;
}
export function locate(latitude, longitude, bounds) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < bounds.latitudeMin || latitude > bounds.latitudeMax
    || longitude < bounds.longitudeMin || longitude > bounds.longitudeMax) return null;
  const x = axisIndex(latitude, bounds.latitudeMin, bounds.latitudeMax);
  const y = axisIndex(longitude, bounds.longitudeMin, bounds.longitudeMax);
  return { regionIndex: Math.floor(x / 20) * 3 + Math.floor(y / 20), cellIndex: (x % 20) * 20 + y % 20 };
}
