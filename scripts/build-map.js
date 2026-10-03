// 由內政部縣市界 TopoJSON（taiwan-atlas）產生台灣本島＋澎湖、綠島、蘭嶼的外框 GeoJSON。
// 排除金門、連江，讓本島能放大置中。
import { writeFileSync } from 'node:fs';
import { merge } from 'topojson-client';

const SOURCE = 'https://cdn.jsdelivr.net/npm/taiwan-atlas@2021.9.20/counties-10t.json';
const EXCLUDE = new Set(['金門縣', '連江縣']);

const topo = JSON.parse(await (await fetch(SOURCE)).text());
const geometries = topo.objects.counties.geometries.filter(
  (g) => !EXCLUDE.has(g.properties.COUNTYNAME)
);
const outline = merge(topo, geometries);

// 座標取到小數 4 位（約 10 公尺），縮小檔案
const round = (c) => (typeof c[0] === 'number' ? c.map((v) => +v.toFixed(4)) : c.map(round));
outline.coordinates = round(outline.coordinates);

const geojson = { type: 'Feature', properties: { name: '台灣' }, geometry: outline };
writeFileSync(new URL('../public/data/taiwan.json', import.meta.url), JSON.stringify(geojson));
console.log('polygons:', outline.coordinates.length);
