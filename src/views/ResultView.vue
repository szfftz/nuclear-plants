<template>
  <div class="my-page my-layout">
    <!-- 左欄：標題、圖層開關、篩選，垂直排列（手機：上方標題區＋下方按鈕） -->
    <aside class="my-side">
      <header class="my-header">
        <button class="back-link" type="button" @click="goBack">
          <span class="my-icon" aria-hidden="true">arrow_back</span>回到前頁
        </button>
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
              <span class="legend-switch" aria-hidden="true"><span class="legend-knob"></span></span>
            </button>
          </li>
        </ul>
      </header>

      <!-- 篩選：桌機在左欄，手機在畫面下方 -->
      <div class="my-side-panel side-foot">
        <div class="filter">
          <div class="my-buttons">
            <button
              v-for="p in PLANTS"
              :key="p.id"
              class="my-button"
              :class="{ active: selected === p.id }"
              type="button"
              @click="selected = p.id"
            >
              <span class="my-dot filter-dot" :style="{ background: p.color }"></span>{{ p.label }}
            </button>
          </div>
          <div class="my-buttons">
            <button class="my-button" :class="{ active: selected === null }" type="button" @click="selected = null">
              全部
            </button>
          </div>
        </div>
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
        <template v-if="!loading" #note>目前有 {{ submissions.length.toLocaleString() }} 人參與</template>
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

  // 回到前一頁；直接打開結果頁（沒有上一頁）時回首頁
  const goBack = () => {
    if (window.history.state?.back) router.back();
    else router.push('/');
  };

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
  /* 標題上方留 pt-4（1.5rem） */
  .back-link + .my-title {
    padding-top: 1.5rem;
    margin-top: -16px;
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
  /* 開關：維持原本 Material 開關的大小，只把白點放大；關掉時軌道變灰、白點移到左邊 */
  .legend-switch {
    --track-w: 1.72em;
    --track-h: 0.92em;
    --knob: 0.7em;
    --gap: calc((var(--track-h) - var(--knob)) / 2);
    position: relative;
    flex: none;
    margin: 0 0.1em;
    width: var(--track-w);
    height: var(--track-h);
    border-radius: 999px;
    background-color: var(--my-color-switch-on);
    transition: background-color 0.2s;
  }
  .legend-knob {
    position: absolute;
    top: var(--gap);
    left: calc(var(--track-w) - var(--knob) - var(--gap));
    width: var(--knob);
    height: var(--knob);
    border-radius: 50%;
    background-color: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: left 0.2s;
  }
  .legend button.off .legend-knob {
    left: var(--gap);
  }
  .legend button.off svg,
  .legend button.off > span:not(.legend-switch) {
    opacity: 0.35;
  }
  .legend button.off .legend-switch {
    background-color: var(--my-color-light-gray);
  }

  /* 篩選：第一排核一～核四、第二排「全部」，撐滿寬度 */
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .filter-dot {
    width: 10px;
    height: 10px;
  }

  /* 回到前頁：純文字連結樣式，不要按鈕外框 */
  .back-link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
    border: none;
    background: none;
    font: inherit;
    letter-spacing: inherit;
    color: var(--my-color-dark-gray);
    cursor: pointer;
    touch-action: manipulation;
  }
  .back-link .my-icon {
    margin: 0;
  }
  .side-foot {
    display: flex;
    flex-direction: column;
    gap: 16px;
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
      flex: 4 1 0;
    }
    .filter .my-buttons:last-child {
      flex: 1 1 0;
    }
    .side-foot {
      gap: 8px;
    }
    .back-link {
      min-height: 36px;
    }
    .back-link + .my-title {
      padding-top: 1.5rem;
      margin-top: -8px;
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
