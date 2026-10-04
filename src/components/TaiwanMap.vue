<!--
  台灣底圖：鋪滿整個畫面（position: fixed），可縮放、拖曳平移。
  元件本身放在版面的地圖區（佔位用）：全台視角會放進這個區域；螢幕右下角有「放大／縮小／顯示全台」按鈕。
  圖層透過 scoped slot 畫在同一個 <svg> 裡：
    project([lon, lat]) -> [x, y]   已套用縮放，標記大小不會跟著變
    invert(pointerEvent) -> [lon, lat]
  點擊地圖（含海面）會 emit('pick', [lon, lat])；拖曳平移不算點擊。
  slot 裡加了 class="no-zoom" 的元素（例如可拖曳的點）按下時不會觸發地圖平移。
-->
<template>
  <div ref="wrap" class="map-wrap">
    <svg
      v-if="projection"
      ref="svg"
      class="map-svg"
      :viewBox="`0 0 ${view.w} ${view.h}`"
      :width="view.w"
      :height="view.h"
      :class="{ pickable }"
      @click="onClick"
    >
      <path class="land" :d="landPath" :transform="transform.toString()" vector-effect="non-scaling-stroke" />
      <slot :project="project" :invert="invert" />
    </svg>

    <div v-if="projection" class="zoom-controls">
      <button type="button" class="zoom-button" aria-label="放大" :disabled="transform.k >= MAX_ZOOM" @click="zoomBy(1.6)">
        <span class="my-icon" aria-hidden="true">add</span>
      </button>
      <button type="button" class="zoom-button" aria-label="縮小" :disabled="isFullView" @click="zoomBy(1 / 1.6)">
        <span class="my-icon" aria-hidden="true">remove</span>
      </button>
      <button type="button" class="zoom-button zoom-reset" :disabled="isFullView" @click="resetZoom">
        <span class="my-icon" aria-hidden="true">zoom_out_map</span>
        <span>顯示全台</span>
      </button>
    </div>
  </div>
</template>

<script setup>
  import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from 'vue';
  import * as d3 from 'd3';

  defineProps({ pickable: { type: Boolean, default: false } });
  const emit = defineEmits(['pick']);

  let landPromise = null;
  const loadLand = () => {
    landPromise ??= fetch(`${import.meta.env.BASE_URL}data/taiwan.json`).then((r) => r.json());
    return landPromise;
  };

  const wrap = ref(null);
  const svg = ref(null);
  const land = ref(null);
  // view：整個畫面（底圖大小）；box：地圖區在畫面上的位置（全台視角放在這裡）
  const view = ref({ w: 0, h: 0 });
  const box = ref({ x0: 0, y0: 0, x1: 0, y1: 0 });
  // 左右多留空間，讓揭曉時的標籤（核四 龍門 等）不會被切掉
  const PADDING_X = 72;
  const PADDING_Y = 24;
  const MAX_ZOOM = 12;
  const ANIMATION_MS = 300;

  const transform = shallowRef(d3.zoomIdentity);
  const isFullView = computed(
    () => transform.value.k <= 1.001 && Math.abs(transform.value.x) < 1 && Math.abs(transform.value.y) < 1
  );

  const projection = computed(() => {
    const { x0, y0, x1, y1 } = box.value;
    if (!land.value || x1 - x0 <= 0 || y1 - y0 <= 0) return null;
    return d3.geoMercator().fitExtent(
      [
        [x0 + PADDING_X, y0 + PADDING_Y],
        [x1 - PADDING_X, y1 - PADDING_Y],
      ],
      land.value
    );
  });

  const landPath = computed(() => d3.geoPath(projection.value)(land.value));

  // 先投影，再套縮放；標記用這個座標，自己的大小不變
  const project = (lonLat) => transform.value.apply(projection.value(lonLat));

  // 底圖鋪滿畫面，螢幕座標就是 svg 座標
  const invert = (event) => projection.value.invert(transform.value.invert([event.clientX, event.clientY]));

  const onClick = (event) => emit('pick', invert(event));

  const zoom = d3
    .zoom()
    .scaleExtent([1, MAX_ZOOM])
    // 手指或滑鼠移動幾 px 內仍算點擊（放點），超過才算拖曳平移
    .clickDistance(6)
    .tapDistance(10)
    .filter((event) => {
      if (event.target.closest?.('.no-zoom')) return false;
      return (!event.ctrlKey || event.type === 'wheel') && !event.button;
    })
    .on('zoom', (event) => {
      transform.value = event.transform;
    });

  // 限制範圍：地圖區中心必須在台灣陸地上（容許離岸 COAST_BUFFER px），超出就停在上一個合法位置；
  // 縮到 1 倍時固定顯示全台。這樣怎麼拖，畫面上都看得到台灣。
  const COAST_BUFFER = 24;
  let lastValid = d3.zoomIdentity;

  const boxCenter = () => [(box.value.x0 + box.value.x1) / 2, (box.value.y0 + box.value.y1) / 2];

  const nearLand = ([x, y]) => {
    for (let r = 0; r <= COAST_BUFFER; r += COAST_BUFFER / 2) {
      const steps = r === 0 ? 1 : 8;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * 2 * Math.PI;
        if (d3.geoContains(land.value, projection.value.invert([x + r * Math.cos(a), y + r * Math.sin(a)]))) return true;
      }
    }
    return false;
  };

  zoom.constrain((t) => {
    if (t.k <= 1.001) return (lastValid = d3.zoomIdentity);
    const [mx, my] = boxCenter();
    if (nearLand(t.invert([mx, my]))) return (lastValid = t);
    // 中心跑到海上：改用上一個合法中心，只套用新的縮放倍率
    const [cx, cy] = lastValid.invert([mx, my]);
    return (lastValid = d3.zoomIdentity.translate(mx - t.k * cx, my - t.k * cy).scale(t.k));
  });

  // 按鈕縮放以地圖區中心為準
  const updateExtent = () => {
    const { x0, y0, x1, y1 } = box.value;
    zoom.extent([
      [x0, y0],
      [x1, y1],
    ]);
  };

  const zoomBy = (factor) => {
    d3.select(svg.value).transition().duration(ANIMATION_MS).call(zoom.scaleBy, factor);
  };
  const resetZoom = () => {
    d3.select(svg.value).transition().duration(ANIMATION_MS).call(zoom.transform, d3.zoomIdentity);
  };

  // svg 出現（地圖資料載入後）才掛上縮放
  watch(svg, (el, old) => {
    if (old) d3.select(old).on('.zoom', null);
    if (!el) return;
    updateExtent();
    d3.select(el).call(zoom).on('dblclick.zoom', null);
  });

  const measure = () => {
    if (!wrap.value) return;
    const r = wrap.value.getBoundingClientRect();
    view.value = { w: window.innerWidth, h: window.innerHeight };
    box.value = { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
  };

  // 版面大小改變時回到全台，避免縮放範圍錯位
  watch(box, () => {
    if (!svg.value) return;
    updateExtent();
    lastValid = d3.zoomIdentity;
    d3.select(svg.value).call(zoom.transform, d3.zoomIdentity);
  });

  let observer = null;
  onMounted(async () => {
    observer = new ResizeObserver(measure);
    observer.observe(wrap.value);
    window.addEventListener('resize', measure);
    measure();
    land.value = await loadLand();
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    window.removeEventListener('resize', measure);
    if (svg.value) d3.select(svg.value).on('.zoom', null);
  });
</script>

<style scoped>
  /* 佔位：決定全台視角放在哪裡，縮放按鈕也放在這個區域的右下角 */
  .map-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  /* 底圖本體：鋪滿整個畫面，在所有內容下面 */
  .map-svg {
    position: fixed;
    inset: 0;
    z-index: 0;
    display: block;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: grab;
  }
  .map-svg:active {
    cursor: grabbing;
  }
  .map-svg.pickable {
    cursor: crosshair;
  }
  .land {
    fill: var(--my-color-land);
    stroke: var(--my-color-light-gray);
    stroke-width: 0.6;
  }

  /* 縮放按鈕：貼在螢幕右下角 */
  .zoom-controls {
    position: fixed;
    right: max(16px, env(safe-area-inset-right));
    bottom: max(16px, env(safe-area-inset-bottom));
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  .zoom-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 40px;
    height: 40px;
    padding: 0 8px;
    border: none;
    border-radius: 8px;
    background-color: var(--my-color-land);
    color: var(--my-color-dark-gray);
    font: inherit;
    letter-spacing: inherit;
    cursor: pointer;
    touch-action: manipulation;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  .zoom-button .my-icon {
    margin: 0;
    vertical-align: 0;
  }
  .zoom-button:hover:not(:disabled) {
    background-color: var(--my-color-highlight-gray);
  }
  .zoom-button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .zoom-reset {
    padding: 0 12px 0 8px;
  }
  /* 手機直式：下方有按鈕區，縮放按鈕放在地圖區右下（仍貼齊螢幕右側） */
  @media (max-width: 767px) {
    .zoom-controls {
      position: absolute;
      right: 0;
      bottom: 8px;
    }
  }
</style>
