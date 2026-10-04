<!-- 核電廠實際位置：電廠顏色的圓形圖示，裡面是白色三葉扇形核能標誌，加陰影 -->
<template>
  <g class="my-badge">
    <circle :r="r" :fill="color" />
    <path :d="bladesPath" fill="#fff" />
    <circle :r="r * 0.14" fill="#fff" />
  </g>
</template>

<script setup>
  import { computed } from 'vue';

  const props = defineProps({
    color: { type: String, required: true },
    r: { type: Number, default: 12 },
  });

  // SVG 的 y 軸朝下：90° 是正下方，另外兩片在左上、右上
  const BLADE_CENTERS = [90, 210, 330];
  const HALF_WIDTH = 30;

  const polar = (radius, deg) => {
    const rad = (deg * Math.PI) / 180;
    return `${(radius * Math.cos(rad)).toFixed(2)} ${(radius * Math.sin(rad)).toFixed(2)}`;
  };

  const bladesPath = computed(() => {
    // 扇葉畫在圓內，留一點邊
    const outer = props.r * 0.78;
    const inner = props.r * 0.24;
    return BLADE_CENTERS.map((c) => {
      const a1 = c - HALF_WIDTH;
      const a2 = c + HALF_WIDTH;
      return (
        `M ${polar(outer, a1)} A ${outer} ${outer} 0 0 1 ${polar(outer, a2)} ` +
        `L ${polar(inner, a2)} A ${inner} ${inner} 0 0 0 ${polar(inner, a1)} Z`
      );
    }).join(' ');
  });
</script>
