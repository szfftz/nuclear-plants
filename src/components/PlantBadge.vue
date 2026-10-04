<!-- 膠囊形的「核一～核四」標籤（放在 <svg> 裡用），加陰影浮在其他點上面 -->
<template>
  <g class="my-badge" :transform="`translate(${at})`">
    <rect x="-22" y="-13" width="44" height="26" rx="13" :fill="plant.color" :stroke="stroke" :stroke-width="strokeWidth" />
    <text class="my-marker-label">{{ plant.label }}</text>
  </g>
</template>

<script setup>
  defineProps({
    plant: { type: Object, required: true },
    // 螢幕座標 [x, y]
    at: { type: Array, required: true },
    stroke: { type: String, default: '#fff' },
    strokeWidth: { type: Number, default: 2 },
  });
</script>
