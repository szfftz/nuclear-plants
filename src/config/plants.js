// 四座核電廠的實際位置（WGS84，主要反應爐廠址）
export const PLANTS = [
  { id: 1, label: '核一', name: '金山', place: '新北市石門區', lon: 121.5862, lat: 25.286, color: 'hsl(210, 80%, 50%)' },
  { id: 2, label: '核二', name: '國聖', place: '新北市萬里區', lon: 121.6622, lat: 25.2034, color: 'hsl(150, 70%, 35%)' },
  { id: 3, label: '核三', name: '馬鞍山', place: '屏東縣恆春鎮', lon: 120.7517, lat: 21.9584, color: 'hsl(0, 75%, 52%)' },
  { id: 4, label: '核四', name: '龍門', place: '新北市貢寮區', lon: 121.9244, lat: 25.0386, color: 'hsl(275, 55%, 52%)' },
];

// 電廠的 [lon, lat]
export const plantPosition = (plant) => [plant.lon, plant.lat];
