<template>
  <BaseChart :option="barOption" :width="width" :height="height" />
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
    default: 'name'
  },
  yAxisKey: {
    type: String,
    default: 'value'
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

const barOption = computed(() => {
  return {
    title: {
      text: props.title
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
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
        type: 'bar',
        data: props.data.map(item => item[props.yAxisKey]),
        itemStyle: {
          color: '#2196F3'
        },
        barWidth: '60%'
      }
    ]
  };
});
</script>