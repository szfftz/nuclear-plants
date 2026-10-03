<!--
  固定不動的台灣地圖（不能縮放、拖曳）。
  圖層透過 scoped slot 畫在同一個 <svg> 裡：
    project([lon, lat]) -> [x, y]
    invert(pointerEvent) -> [lon, lat]
  點擊地圖（含海面）會 emit('pick', [lon, lat])。
-->
<template>
  <div ref="wrap" class="map-wrap">
    <svg
      v-if="projection"
      ref="svg"
      :viewBox="`0 0 ${size.w} ${size.h}`"
      :width="size.w"
      :height="size.h"
      :class="{ pickable }"
      @click="onClick"
    >
      <path class="land" :d="landPath" />
      <slot :project="project" :invert="invert" />
    </svg>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
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
  const size = ref({ w: 0, h: 0 });
  const PADDING = 16;

  const projection = computed(() => {
    const { w, h } = size.value;
    if (!land.value || w <= 0 || h <= 0) return null;
    return d3.geoMercator().fitExtent(
      [
        [PADDING, PADDING],
        [w - PADDING, h - PADDING],
      ],
      land.value
    );
  });

  const landPath = computed(() => d3.geoPath(projection.value)(land.value));

  const project = (lonLat) => projection.value(lonLat);

  const invert = (event) => {
    const rect = svg.value.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * size.value.w;
    const y = ((event.clientY - rect.top) / rect.height) * size.value.h;
    return projection.value.invert([x, y]);
  };

  const onClick = (event) => emit('pick', invert(event));

  let observer = null;
  onMounted(async () => {
    observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      size.value = { w: Math.floor(width), h: Math.floor(height) };
    });
    observer.observe(wrap.value);
    land.value = await loadLand();
  });
  onBeforeUnmount(() => observer?.disconnect());
</script>

<style scoped>
  .map-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  svg {
    position: absolute;
    inset: 0;
    display: block;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  svg.pickable {
    cursor: crosshair;
  }
  .land {
    fill: var(--my-color-land);
    stroke: var(--my-color-light-gray);
    stroke-width: 0.6;
  }
</style>
