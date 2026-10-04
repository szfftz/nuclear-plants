<template>
  <div class="my-page my-layout">
    <!-- 左欄：標題、圖層開關、篩選，垂直排列（手機：上方標題區＋下方按鈕） -->
    <aside class="my-side">
      <header class="my-header">
        <h1 class="my-title">大家點的位置</h1>

        <ul class="legend">
          <li v-for="layer in layers" :key="layer.key">
            <button
              type="button"
              :class="{ off: !show[layer.key] }"
              :aria-pressed="show[layer.key]"
              @click="show[layer.key] = !show[layer.key]"
            >
              <svg width="28" height="24" viewBox="-14 -12 28 24" aria-hidden="true">
                <template v-if="layer.key === 'crowd'">
                  <circle
                    v-for="(p, k) in PLANTS"
                    :key="p.id"
                    :cx="[-7, 7, -7, 7][k]"
                    :cy="[-4, -4, 4, 4][k]"
                    r="3.5"
                    :fill="p.color"
                    fill-opacity="0.6"
                    stroke="#fff"
                    stroke-width="1"
                  />
                </template>
                <NuclearMarker v-else-if="layer.key === 'actual'" color="var(--my-color-dark-gray)" :r="10" />
                <rect
                  v-else
                  class="my-badge"
                  x="-12"
                  y="-8"
                  width="24"
                  height="16"
                  rx="8"
                  fill="var(--my-color-dark-gray)"
                  stroke="var(--my-color-yellow)"
                  stroke-width="2.5"
                />
              </svg>
              <span>{{ layer.label }}</span>
              <span class="my-icon my-icon-fill legend-switch" aria-hidden="true">{{ show[layer.key] ? 'toggle_on' : 'toggle_off' }}</span>
            </button>
          </li>
        </ul>

        <div class="filter">
          <div class="my-buttons">
            <button class="my-button" :class="{ active: selected === null }" type="button" @click="selected = null">
              全部
            </button>
          </div>
          <div class="my-buttons">
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
        </div>
      </header>

      <div class="my-side-panel side-foot">
        <button class="my-button primary" type="button" @click="router.push('/')">
          {{ mine ? '再玩一次' : '我也要玩' }}
        </button>
        <span v-if="!loading" class="my-muted">目前有 {{ submissions.length.toLocaleString() }} 人參與</span>
      </div>
    </aside>

    <main class="my-map">
      <TaiwanMap>
        <template #default="{ project }">
          <!-- 所有人的點 -->
          <g v-if="show.crowd">
            <template v-for="plant in visiblePlants" :key="`crowd-${plant.id}`">
              <circle
                v-for="(s, k) in submissions"
                :key="k"
                :transform="`translate(${project(s.guesses[plant.id - 1])})`"
                r="5"
                :fill="plant.color"
                fill-opacity="0.6"
                stroke="#fff"
                stroke-width="1"
              />
            </template>
          </g>

          <!-- 你放的位置 -->
          <g v-if="mine && show.mine">
            <g
              v-for="plant in visiblePlants"
              :key="`mine-${plant.id}`"
              class="my-badge"
              :transform="`translate(${project(mine.guesses[plant.id - 1])})`"
            >
              <rect x="-22" y="-13" width="44" height="26" rx="13" :fill="plant.color" stroke="var(--my-color-yellow)" stroke-width="3" />
              <text class="my-marker-label">{{ plant.label }}</text>
            </g>
          </g>

          <!-- 實際位置 -->
          <g v-if="show.actual">
            <g v-for="plant in visiblePlants" :key="`actual-${plant.id}`" :transform="`translate(${project([plant.lon, plant.lat])})`">
              <NuclearMarker :color="plant.color" :r="12" />
            </g>
          </g>
        </template>
      </TaiwanMap>
    </main>

    <div v-if="loading" class="my-overlay">載入中…</div>
    <div v-else-if="error" class="my-overlay">讀取失敗：{{ error }}</div>
  </div>
</template>

<script setup>
  import { ref, reactive, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import TaiwanMap from '../components/TaiwanMap.vue';
  import NuclearMarker from '../components/NuclearMarker.vue';
  import { PLANTS } from '../config/plants.js';
  import { fetchSubmissions, getCookieId, getLocalAnswer } from '../config/api.js';

  const router = useRouter();
  const submissions = ref([]);
  const loading = ref(true);
  const error = ref('');
  const selected = ref(null);

  // 地圖圖層開關
  const show = reactive({ crowd: true, actual: true, mine: true });

  // 你的點用這台裝置最新一次作答（第一次之後的改動只存在 localStorage）；沒有的話用你上傳的那筆
  const myUpload = computed(() => submissions.value.find((s) => s.cookieId === getCookieId()) ?? null);
  const mine = computed(() => getLocalAnswer() ?? myUpload.value);

  const layers = computed(() => [
    { key: 'crowd', label: '每個人放的位置' },
    { key: 'actual', label: '實際位置' },
    ...(mine.value ? [{ key: 'mine', label: '你放的位置' }] : []),
  ]);

  const visiblePlants = computed(() => (selected.value === null ? PLANTS : PLANTS.filter((p) => p.id === selected.value)));

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
  .my-header {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .my-title {
    margin-bottom: 4px;
  }

  /* 圖層開關：一個一行 */
  .legend {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .legend button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 2px 0;
    border: none;
    background: none;
    font: inherit;
    letter-spacing: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    touch-action: manipulation;
  }
  .legend button > span:not(.legend-switch) {
    flex: 1;
  }
  .legend svg {
    flex: none;
    display: block;
    overflow: visible;
  }
  .legend-switch {
    font-size: 1.8em;
    color: var(--my-color-switch-on);
  }
  .legend button.off svg,
  .legend button.off span:not(.legend-switch) {
    opacity: 0.35;
  }
  .legend button.off .legend-switch {
    color: var(--my-color-light-gray);
  }

  /* 篩選：第一排「全部」、第二排核一～核四，撐滿寬度 */
  .filter {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .filter .my-buttons {
    flex-wrap: nowrap;
  }
  .filter .my-button {
    flex: 1 1 0;
    min-width: 0;
    padding-left: 4px;
    padding-right: 4px;
  }

  .side-foot {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @media (max-width: 767px) {
    .my-header {
      gap: 8px;
    }
    .my-title {
      margin-bottom: 0;
    }
    .legend {
      gap: 0;
      font-size: 0.9rem;
    }
    .legend svg {
      transform: scale(0.85);
    }
    /* 篩選併成一排五顆 */
    .filter {
      flex-direction: row;
      gap: 6px;
    }
    .filter .my-buttons {
      gap: 6px;
    }
    .filter .my-buttons:first-child {
      flex: 1 1 0;
    }
    .filter .my-buttons:last-child {
      flex: 4 1 0;
    }
    .side-foot {
      flex-direction: row-reverse;
      align-items: center;
      justify-content: space-between;
    }
    .side-foot .my-button {
      flex: none;
      padding: 10px 20px;
    }
  }

  /* 手機橫式 */
  @media (orientation: landscape) and (max-height: 560px) {
    .my-header {
      gap: 6px;
    }
    .legend {
      gap: 0;
    }
  }
</style>
