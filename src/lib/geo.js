// 經緯度與 SVG 座標的小工具；點一律是 [lon, lat] 或 [x, y]

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

// 兩點大圓距離（公里，haversine）
export const distanceKm = (a, b) => {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

// 10 公里以下留一位小數
export const formatKm = (km) => (km < 10 ? km.toFixed(1) : Math.round(km).toString());

// SVG <line> 的屬性
export const lineAttrs = ([x1, y1], [x2, y2]) => ({ x1, y1, x2, y2 });

export const midpoint = ([x1, y1], [x2, y2]) => [(x1 + x2) / 2, (y1 + y2) / 2];
