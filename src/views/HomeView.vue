<template>
  <div class="my-page my-layout">
    <aside class="my-side">
      <header class="my-header">
        <h1 class="my-title"><span class="my-nowrap">台灣四座核電廠，</span><span class="my-nowrap">你知道在哪裡嗎？</span></h1>
        <ul class="my-plant-list">
          <li v-for="(p, i) in PLANTS" :key="p.id" class="my-plant-row" :class="{ 'my-muted': !revealed && i > guesses.length }">
            <span class="my-plant-pill" :class="{ 'my-now': !revealed && i === guesses.length }" :style="{ background: p.color }">
              {{ p.label }}
            </span>
            <span class="my-num">
              <template v-if="revealed">差 {{ formatKm(results[i].km) }} km</template>
            </span>
          </li>
        </ul>
      </header>

      <div class="my-panel my-side-panel">
        <div v-if="revealed" class="my-muted">
          <template v-if="saveState === 'saving'">上傳中…</template>
          <template v-else-if="saveState === 'uploaded'">已送出<span class="my-icon" aria-hidden="true">check</span></template>
          <template v-else-if="saveState === 'local'">你已經送出過了，這次的結果只存在這台裝置</template>
          <template v-else-if="saveState === 'error'">
            上傳失敗：{{ saveError }}
            <button class="my-button" type="button" @click="save">重試</button>
          </template>
        </div>
        <!-- 不論是否揭曉都可以重設、確定；「看大家點的位置」一直顯示，送出過才能按 -->
        <div class="my-buttons">
          <button class="my-button" type="button" :disabled="!guesses.length" @click="reset">重設</button>
          <button
            class="my-button primary"
            type="button"
            :disabled="guesses.length < PLANTS.length"
            @click="confirm"
          >
            確定
          </button>
          <button class="my-button result-button" type="button" :disabled="!submittedBefore" @click="router.push('/result')">
            看大家點的位置
          </button>
        </div>
        <div v-if="participants !== null" class="my-muted participants">目前有 {{ participants.toLocaleString() }} 人參與</div>
      </div>
    </aside>

    <main class="my-map">
      <!-- 地圖正中央的浮水印：所有提示都在這裡 -->
      <div class="map-hint" aria-live="polite">
        <div v-if="revealed">平均差了 {{ formatKm(averageKm) }} 公里</div>
        <div v-else-if="nextPlant">
          在地圖上點出 <span :style="{ color: nextPlant.color }">{{ nextPlant.label }}</span> 的位置
        </div>
        <template v-else>
          <div>四個點都放好了</div>
          <div class="map-hint-sub">可以拖曳調整位置</div>
        </template>
        <div v-if="!guesses.length" class="map-hint-sub">地圖可縮放位移</div>
      </div>
      <TaiwanMap @pick="addGuess">
        <template #default="{ project, invert }">
          <!-- 揭曉：猜測 → 實際的連線與距離 -->
          <g v-if="revealed" class="my-fade-in">
            <g v-for="r in results" :key="`line-${r.plant.id}`">
              <line
                v-bind="lineAttrs(project(r.guess), project(r.actual))"
                :stroke="r.plant.color"
                stroke-width="1.5"
                stroke-dasharray="4 3"
              />
              <text class="my-map-text" v-bind="kmLabelAttrs(project(r.guess), project(r.actual))" :fill="r.plant.color">
                {{ formatKm(r.km) }} km
              </text>
            </g>
            <g
              v-for="r in results"
              :key="`actual-${r.plant.id}`"
              :transform="`translate(${project(r.actual)})`"
            >
              <NuclearMarker :color="r.plant.color" :r="13" />
            </g>
          </g>

          <!-- 使用者放的點：可拖曳微調 -->
          <PlantBadge
            v-for="(g, i) in guesses"
            :key="`guess-${i}`"
            :plant="PLANTS[i]"
            :at="project(g)"
            class="guess no-zoom"
            @click.stop
            @pointerdown="startDrag($event, i)"
            @pointermove="dragging === i && moveGuess(i, invert($event))"
            @pointerup="dragging = null"
            @pointercancel="dragging = null"
          />
        </template>
      </TaiwanMap>
    </main>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import TaiwanMap from '../components/TaiwanMap.vue';
  import NuclearMarker from '../components/NuclearMarker.vue';
  import PlantBadge from '../components/PlantBadge.vue';
  import { PLANTS, plantPosition } from '../config/plants.js';
  import { distanceKm, formatKm, lineAttrs, midpoint } from '../lib/geo.js';
  import { submitAnswer, hasSubmitted, checkUploaded, fetchMyAnswer, fetchParticipantCount } from '../services/answers.js';
  import { trackEvent } from '../lib/analytics.js';

  const router = useRouter();
  const guesses = ref([]);
  const revealed = ref(false);
  const dragging = ref(null);
  const saveState = ref('idle');
  const saveError = ref('');
  const submittedBefore = ref(hasSubmitted());
  const participants = ref(null);

  const loadParticipants = async () => {
    try {
      participants.value = await fetchParticipantCount();
    } catch {
      // 讀不到就不顯示人數
    }
  };
  onMounted(async () => {
    loadParticipants();
    // 以資料庫為準更新「有沒有送出過」；送出過就帶出上次的作答，可以直接重設、確定
    submittedBefore.value = await checkUploaded();
    if (submittedBefore.value && !guesses.value.length) {
      const previous = await fetchMyAnswer();
      if (previous && !guesses.value.length) {
        guesses.value = previous;
        revealed.value = true;
        saveState.value = 'restored';
      }
    }
  });

  const nextPlant = computed(() => PLANTS[guesses.value.length] ?? null);

  const results = computed(() =>
    PLANTS.map((plant, i) => {
      const guess = guesses.value[i];
      const actual = plantPosition(plant);
      return { plant, guess, actual, km: distanceKm(guess, actual) };
    })
  );
  const averageKm = computed(() => results.value.reduce((s, r) => s + r.km, 0) / results.value.length);

  const addGuess = (lonLat) => {
    if (revealed.value || !nextPlant.value) return;
    guesses.value.push(lonLat);
  };

  // 揭曉後再調整：回到作答狀態，改完再按確定
  const unreveal = () => {
    revealed.value = false;
    saveState.value = 'idle';
  };

  const startDrag = (event, i) => {
    if (revealed.value) unreveal();
    dragging.value = i;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveGuess = (i, lonLat) => {
    guesses.value[i] = lonLat;
  };

  const save = async () => {
    saveState.value = 'saving';
    try {
      saveState.value = await submitAnswer(guesses.value);
      submittedBefore.value = true; // uploaded 或 local 都代表資料庫裡已經有了
      trackEvent('submit_answer', { result: saveState.value, average_km: Math.round(averageKm.value) });
      if (saveState.value === 'uploaded') loadParticipants();
    } catch (e) {
      saveError.value = e.message;
      saveState.value = 'error';
    }
  };

  const confirm = () => {
    trackEvent('confirm_answer', { average_km: Math.round(averageKm.value) });
    revealed.value = true;
    save();
  };

  const reset = () => {
    guesses.value = [];
    revealed.value = false;
    saveState.value = 'idle';
  };

  // 距離標籤放在連線中點右邊
  const kmLabelAttrs = (from, to) => {
    const [x, y] = midpoint(from, to);
    return { x: x + 8, y };
  };
</script>

<style scoped>
  /* 浮水印：大字、半透明，不擋點擊 */
  .map-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    text-align: center;
    font-size: 2.5rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--my-color-dark-gray);
    opacity: 0.25;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
  }
  .map-hint-sub {
    margin-top: 8px;
    font-size: 0.6em;
  }
  @media (max-width: 1023px) {
    .map-hint {
      font-size: 2rem;
    }
  }
  @media (max-width: 767px) {
    .map-hint {
      font-size: 1.5rem;
      letter-spacing: 0.05em;
    }
  }
  /* 手機上按鈕平分寬度時，字比較多的這顆給兩倍寬 */
  @media (max-width: 767px), (orientation: landscape) and (max-height: 560px) {
    .my-buttons > .result-button {
      flex-grow: 2;
    }
  }
  .guess {
    cursor: grab;
  }
  .guess:active {
    cursor: grabbing;
  }
</style>
