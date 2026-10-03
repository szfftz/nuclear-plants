<template>
  <div class="my-page">
    <header class="my-header">
      <h1 class="my-title">大家點的位置</h1>
      <div class="my-subtitle">
        小點是每個人放的位置，<span class="legend-diamond">◆</span> 是實際位置，<span class="legend-ring">◎</span>
        是大家的平均位置<template v-if="mine">，<span class="legend-mine">●</span> 是你放的</template>
      </div>
    </header>

    <main class="my-body">
      <TaiwanMap>
        <template #default="{ project }">
          <!-- 所有人的點 -->
          <g class="crowd">
            <template v-for="plant in visiblePlants" :key="`crowd-${plant.id}`">
              <circle
                v-for="(s, k) in submissions"
                :key="k"
                :transform="`translate(${project(s.guesses[plant.id - 1])})`"
                r="3"
                :fill="plant.color"
                fill-opacity="0.35"
              />
            </template>
          </g>

          <!-- 大家的平均位置 → 實際位置 -->
          <g v-for="st in visibleStats" :key="`mean-${st.plant.id}`">
            <line
              v-if="st.mean"
              v-bind="lineAttrs(project(st.mean), project(st.actual))"
              :stroke="st.plant.color"
              stroke-width="1.5"
              stroke-dasharray="4 3"
            />
            <circle
              v-if="st.mean"
              :transform="`translate(${project(st.mean)})`"
              r="7"
              fill="none"
              :stroke="st.plant.color"
              stroke-width="2.5"
            />
          </g>

          <!-- 你的點 -->
          <g v-if="mine">
            <g v-for="plant in visiblePlants" :key="`mine-${plant.id}`" :transform="`translate(${project(mine.guesses[plant.id - 1])})`">
              <circle r="9" :fill="plant.color" stroke="var(--my-color-yellow)" stroke-width="3" />
              <text class="my-marker-label">{{ plant.id }}</text>
            </g>
          </g>

          <!-- 實際位置 -->
          <g v-for="st in visibleStats" :key="`actual-${st.plant.id}`" :transform="`translate(${project(st.actual)})`">
            <rect x="-6" y="-6" width="12" height="12" transform="rotate(45)" :fill="st.plant.color" stroke="#fff" stroke-width="1.5" />
          </g>
        </template>
      </TaiwanMap>

      <aside class="my-panel">
        <div class="my-buttons">
          <button class="my-button" :class="{ active: selected === null }" type="button" @click="selected = null">全部</button>
          <button
            v-for="p in PLANTS"
            :key="p.id"
            class="my-button"
            :class="{ active: selected === p.id }"
            type="button"
            @click="selected = p.id"
          >
            {{ p.label }}
          </button>
        </div>

        <table class="stats">
          <thead>
            <tr>
              <th></th>
              <th>平均差</th>
              <th>中位數</th>
              <th v-if="mine">你</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="st in stats" :key="st.plant.id" :class="{ 'my-muted': selected !== null && selected !== st.plant.id }">
              <td>
                <span class="my-dot" :style="{ background: st.plant.color }"></span>
                {{ st.plant.label }} {{ st.plant.name }}
              </td>
              <td class="my-num">{{ st.n ? formatKm(st.meanKm) : '–' }}</td>
              <td class="my-num">{{ st.n ? formatKm(st.medianKm) : '–' }}</td>
              <td v-if="mine" class="my-num">{{ formatKm(st.mineKm) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="my-muted">單位：公里。「平均位置」離實際位置 {{ crowdMeanText }}</div>
        <div v-if="mine && myRank" class="my-muted">你的總誤差贏過 {{ myRank }}% 的人</div>

        <div class="my-buttons">
          <button class="my-button primary" type="button" @click="router.push('/')">
            {{ mine ? '再玩一次' : '我也要玩' }}
          </button>
        </div>
      </aside>
    </main>

    <footer class="my-footer">
      <span>目前有 {{ submissions.length.toLocaleString() }} 人參與</span>
    </footer>

    <div v-if="loading" class="my-overlay">載入中…</div>
    <div v-else-if="error" class="my-overlay">讀取失敗：{{ error }}</div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import * as d3 from 'd3';
  import TaiwanMap from '../components/TaiwanMap.vue';
  import { PLANTS, distanceKm, formatKm } from '../config/plants.js';
  import { fetchSubmissions, getCookieId, getLocalAnswer } from '../config/api.js';

  const router = useRouter();
  const submissions = ref([]);
  const loading = ref(true);
  const error = ref('');
  const selected = ref(null);

  // 你的點用這台裝置最新一次作答（第一次之後的改動只存在 localStorage）；沒有的話用你上傳的那筆
  const myUpload = computed(() => submissions.value.find((s) => s.cookieId === getCookieId()) ?? null);
  const mine = computed(() => getLocalAnswer() ?? myUpload.value);

  const visiblePlants = computed(() => (selected.value === null ? PLANTS : PLANTS.filter((p) => p.id === selected.value)));

  const stats = computed(() =>
    PLANTS.map((plant) => {
      const actual = [plant.lon, plant.lat];
      const points = submissions.value.map((s) => s.guesses[plant.id - 1]);
      const kms = points.map((g) => distanceKm(g, actual));
      // 台灣範圍小，經緯度直接平均當作群眾的「平均位置」就夠準
      const mean = points.length ? [d3.mean(points, (g) => g[0]), d3.mean(points, (g) => g[1])] : null;
      return {
        plant,
        actual,
        n: points.length,
        mean,
        meanKm: d3.mean(kms),
        medianKm: d3.median(kms),
        crowdKm: mean ? distanceKm(mean, actual) : null,
        mineKm: mine.value ? distanceKm(mine.value.guesses[plant.id - 1], actual) : null,
      };
    })
  );
  const visibleStats = computed(() => stats.value.filter((st) => visiblePlants.value.includes(st.plant)));

  const crowdMeanText = computed(() => {
    const list = visibleStats.value.filter((st) => st.crowdKm !== null);
    if (!list.length) return '–';
    return list.map((st) => `${st.plant.label} ${formatKm(st.crowdKm)}`).join('、');
  });

  const totalKm = (s) => PLANTS.reduce((sum, p) => sum + distanceKm(s.guesses[p.id - 1], [p.lon, p.lat]), 0);
  const myRank = computed(() => {
    if (!mine.value || submissions.value.length < 2) return null;
    const my = totalKm(mine.value);
    const others = submissions.value.filter((s) => s !== myUpload.value);
    return Math.round((others.filter((s) => totalKm(s) > my).length / others.length) * 100);
  });

  const lineAttrs = ([x1, y1], [x2, y2]) => ({ x1, y1, x2, y2 });

  onMounted(async () => {
    try {
      submissions.value = await fetchSubmissions();
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  });
</script>

<style scoped>
  .stats {
    width: 100%;
    border-collapse: collapse;
  }
  .stats th {
    font-weight: 400;
    text-align: right;
    color: var(--my-color-light-gray);
    padding-bottom: 4px;
  }
  .stats td {
    padding: 3px 0;
    white-space: nowrap;
  }
  .stats td:not(:first-child) {
    text-align: right;
    padding-left: 8px;
  }
  .stats .my-dot {
    display: inline-block;
    vertical-align: -1px;
    margin-right: 4px;
  }
  .legend-mine {
    color: var(--my-color-yellow);
  }
</style>
