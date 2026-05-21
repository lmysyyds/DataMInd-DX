<template>
  <BaseChart :option="pieOption" :width="width" :height="height" />
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
  nameKey: {
    type: String,
    default: 'name'
  },
  valueKey: {
    type: String,
    default: 'value'
  },
  title: {
    type: String,
    default: ''
  }
});

const pieOption = computed(() => {
  return {
    title: {
      text: props.title
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: '0%',
      left: 'center',
      data: props.data.map(item => item[props.nameKey])
    },
    series: [
      {
        name: '数据',
        type: 'pie',
        radius: '50%',
        center: ['50%', '45%'],
        data: props.data.map(item => ({
          name: item[props.nameKey],
          value: item[props.valueKey]
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };
});
</script>