<template>
  <div class="my-page">
    <header class="my-header">
      <h1 class="my-title">核電廠在哪裡？</h1>
      <div class="my-subtitle">
        <template v-if="revealed">
          平均差了 <strong>{{ formatKm(averageKm) }}</strong> 公里，虛線連到真正的位置
        </template>
        <template v-else-if="nextPlant">
          在地圖上點出
          <strong :style="{ color: nextPlant.color }">{{ nextPlant.label }}</strong>
          的位置（{{ guesses.length + 1 }} / {{ PLANTS.length }}）
        </template>
        <template v-else>四個點都放好了，可以拖曳微調，再按「確定」</template>
      </div>
    </header>

    <main class="my-body">
      <TaiwanMap :pickable="!revealed && !!nextPlant" @pick="addGuess">
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
              <text
                class="my-map-text"
                :x="midpoint(project(r.guess), project(r.actual))[0] + 8"
                :y="midpoint(project(r.guess), project(r.actual))[1]"
                :fill="r.plant.color"
              >
                {{ formatKm(r.km) }} km
              </text>
            </g>
            <g
              v-for="(r, i) in results"
              :key="`actual-${r.plant.id}`"
              :transform="`translate(${project(r.actual)})`"
            >
              <rect x="-6" y="-6" width="12" height="12" transform="rotate(45)" :fill="r.plant.color" stroke="#fff" stroke-width="1.5" />
              <text class="my-map-text" :x="ACTUAL_LABEL_OFFSET[i][0]" :y="ACTUAL_LABEL_OFFSET[i][1]" :text-anchor="ACTUAL_LABEL_OFFSET[i][0] < 0 ? 'end' : 'start'" dominant-baseline="central">
                {{ r.plant.label }} {{ r.plant.name }}
              </text>
            </g>
          </g>

          <!-- 使用者放的點 -->
          <g
            v-for="(g, i) in guesses"
            :key="`guess-${i}`"
            :transform="`translate(${project(g)})`"
            :class="['guess', { draggable: !revealed }]"
            @click.stop
            @pointerdown="startDrag($event, i)"
            @pointermove="dragging === i && moveGuess(i, invert($event))"
            @pointerup="dragging = null"
            @pointercancel="dragging = null"
          >
            <circle r="11" :fill="PLANTS[i].color" stroke="#fff" stroke-width="2" />
            <text class="my-marker-label">{{ i + 1 }}</text>
          </g>
        </template>
      </TaiwanMap>

      <aside class="my-panel">
        <ul class="my-plant-list">
          <li v-for="(p, i) in PLANTS" :key="p.id" class="my-plant-row" :class="{ 'my-muted': !revealed && i > guesses.length }">
            <span class="my-dot" :style="{ background: p.color }"></span>
            <span>{{ p.label }}<template v-if="revealed">（{{ p.name }}）</template></span>
            <span class="my-num">
              <template v-if="revealed">差 {{ formatKm(results[i].km) }} km</template>
              <template v-else-if="i < guesses.length">已放</template>
              <template v-else-if="i === guesses.length">← 現在</template>
            </span>
          </li>
        </ul>

        <div v-if="!revealed" class="my-buttons">
          <button class="my-button primary" type="button" :disabled="guesses.length < PLANTS.length" @click="confirm">
            確定
          </button>
          <button class="my-button" type="button" :disabled="!guesses.length" @click="guesses.pop()">復原</button>
          <button class="my-button" type="button" :disabled="!guesses.length" @click="reset">全部重設</button>
        </div>
        <template v-else>
          <div class="my-muted">
            <template v-if="saveState === 'saving'">上傳中…</template>
            <template v-else-if="saveState === 'uploaded'">已送出 ✓</template>
            <template v-else-if="saveState === 'local'">你已經送出過了，這次的結果只存在這台裝置</template>
            <template v-else-if="saveState === 'error'">
              上傳失敗：{{ saveError }}
              <button class="my-button" type="button" @click="save">重試</button>
            </template>
          </div>
          <div class="my-buttons">
            <button class="my-button primary" type="button" @click="router.push('/result')">看大家點的位置</button>
            <button class="my-button" type="button" @click="reset">再玩一次</button>
          </div>
        </template>
        <button v-if="!revealed && submittedBefore" class="my-button" type="button" @click="router.push('/result')">
          直接看結果
        </button>
      </aside>
    </main>

    <footer class="my-footer">
      <span>台灣四座核電廠，你知道在哪裡嗎？</span>
    </footer>
  </div>
</template>

<script setup>
  import { ref, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import TaiwanMap from '../components/TaiwanMap.vue';
  import { PLANTS, distanceKm, formatKm } from '../config/plants.js';
  import { submitAnswer, hasSubmitted } from '../config/api.js';

  // 核一、核二、核四 都在北海岸，標籤錯開避免重疊
  const ACTUAL_LABEL_OFFSET = [
    [-10, -10],
    [10, -10],
    [10, 0],
    [10, 10],
  ];

  const router = useRouter();
  const guesses = ref([]);
  const revealed = ref(false);
  const dragging = ref(null);
  const saveState = ref('idle');
  const saveError = ref('');
  const submittedBefore = ref(hasSubmitted());

  const nextPlant = computed(() => PLANTS[guesses.value.length] ?? null);

  const results = computed(() =>
    PLANTS.map((plant, i) => {
      const guess = guesses.value[i];
      const actual = [plant.lon, plant.lat];
      return { plant, guess, actual, km: distanceKm(guess, actual) };
    })
  );
  const averageKm = computed(() => results.value.reduce((s, r) => s + r.km, 0) / results.value.length);

  const addGuess = (lonLat) => {
    if (revealed.value || !nextPlant.value) return;
    guesses.value.push(lonLat);
  };

  const startDrag = (event, i) => {
    if (revealed.value) return;
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
      submittedBefore.value = true;
    } catch (e) {
      saveError.value = e.message;
      saveState.value = 'error';
    }
  };

  const confirm = () => {
    revealed.value = true;
    save();
  };

  const reset = () => {
    guesses.value = [];
    revealed.value = false;
    saveState.value = 'idle';
  };

  const lineAttrs = ([x1, y1], [x2, y2]) => ({ x1, y1, x2, y2 });
  const midpoint = ([x1, y1], [x2, y2]) => [(x1 + x2) / 2, (y1 + y2) / 2];
</script>

<style scoped>
  .guess.draggable {
    cursor: grab;
  }
  .guess.draggable:active {
    cursor: grabbing;
  }
</style>
