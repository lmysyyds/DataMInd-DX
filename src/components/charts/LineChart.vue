<template>
  <BaseChart :option="lineOption" :width="width" :height="height" />
</template>

<script setup>
import { computed } from 'vue';
import BaseChart from './BaseChart.vue';

const props = defineProps({
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '400px'
  },
  data: {
    type: Array,
    required: true
  },
  xAxisKey: {
    type: String,
    default: 'x'
  },
  yAxisKey: {
    type: String,
    default: 'y'
  },
  title: {
    type: String,
    default: ''
  },
  seriesName: {
    type: String,
    default: '数据'
  }
});

const lineOption = computed(() => {
  return {
    title: {
      text: props.title
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: props.data.map(item => item[props.xAxisKey])
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: props.seriesName,
        type: 'line',
        data: props.data.map(item => item[props.yAxisKey]),
        smooth: true,
        lineStyle: {
          width: 3
        },
        itemStyle: {
          color: '#4CAF50'
        }
      }
    ]
  };
});
</script>