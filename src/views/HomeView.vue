<template>
  <div class="my-page my-layout">
    <aside class="my-side">
      <header class="my-header">
        <h1 class="my-title"><span class="my-nowrap">台灣四座核電廠，</span><span class="my-nowrap">你知道在哪裡嗎？</span></h1>
        <div class="my-prompt" aria-live="polite">
          <template v-if="revealed">
            平均差了 <strong>{{ formatKm(averageKm) }}</strong> 公里
          </template>
          <template v-else-if="nextPlant">
            在地圖上點出
            <strong class="my-prompt-plant" :style="{ color: nextPlant.color }">{{ nextPlant.label }}</strong>
            的位置
          </template>
          <template v-else>
            四個點都放好了
            <span class="my-prompt-note">可以拖曳微調，再按「確定」</span>
          </template>
        </div>
        <ul class="my-plant-list">
          <li v-for="(p, i) in PLANTS" :key="p.id" class="my-plant-row" :class="{ 'my-muted': !revealed && i > guesses.length }">
            <span class="my-dot" :style="{ background: p.color }"></span>
            <span>{{ p.label }}<template v-if="revealed">（{{ p.name }}）</template></span>
            <span class="my-num">
              <template v-if="revealed">差 {{ formatKm(results[i].km) }} km</template>
              <template v-else-if="i < guesses.length">已放</template>
              <span v-else-if="i === guesses.length" class="my-now"><span class="my-icon" aria-hidden="true">arrow_back</span>現在</span>
            </span>
          </li>
        </ul>
      </header>

      <div class="my-panel my-side-panel">
        <div v-if="revealed" class="my-muted">
          <template v-if="saveState === 'saving'">上傳中…</template>
          <template v-else-if="saveState === 'uploaded'">已送出<span class="my-icon" aria-hidden="true">check</span></template>
          <template v-else-if="saveState === 'local'">你已經送出過了，這次的結果只存在這台裝置</template>
          <template v-else-if="saveState === 'restored'">這是你上次的作答</template>
          <template v-else-if="saveState === 'error'">
            上傳失敗：{{ saveError }}
            <button class="my-button" type="button" @click="save">重試</button>
          </template>
        </div>
        <!-- 不論是否揭曉都可以重設、確定；送出過才有「看結果」 -->
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
          <button v-if="submittedBefore" class="my-button" type="button" @click="router.push('/result')">看結果</button>
        </div>
      </div>
    </aside>

    <main class="my-map">
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
              v-for="r in results"
              :key="`actual-${r.plant.id}`"
              :transform="`translate(${project(r.actual)})`"
            >
              <NuclearMarker :color="r.plant.color" :r="13" />
            </g>
          </g>

          <!-- 使用者放的點 -->
          <g
            v-for="(g, i) in guesses"
            :key="`guess-${i}`"
            :transform="`translate(${project(g)})`"
            :class="['guess', 'my-badge', 'draggable', 'no-zoom']"
            @click.stop
            @pointerdown="startDrag($event, i)"
            @pointermove="dragging === i && moveGuess(i, invert($event))"
            @pointerup="dragging = null"
            @pointercancel="dragging = null"
          >
            <rect x="-22" y="-13" width="44" height="26" rx="13" :fill="PLANTS[i].color" stroke="#fff" stroke-width="2" />
            <text class="my-marker-label">{{ PLANTS[i].label }}</text>
          </g>
        </template>
        <template v-if="participants !== null" #note>目前有 {{ participants.toLocaleString() }} 人參與</template>
      </TaiwanMap>

    </main>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import TaiwanMap from '../components/TaiwanMap.vue';
  import NuclearMarker from '../components/NuclearMarker.vue';
  import { PLANTS, distanceKm, formatKm } from '../config/plants.js';
  import { submitAnswer, hasSubmitted, checkUploaded, fetchMyAnswer, fetchParticipantCount } from '../config/api.js';

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
      const actual = [plant.lon, plant.lat];
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
      if (saveState.value === 'uploaded') loadParticipants();
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
