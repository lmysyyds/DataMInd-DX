<template>
  <div ref="chartRef" class="chart-container" :style="{ width: width, height: height }"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '400px'
  },
  option: {
    type: Object,
    required: true
  },
  autoResize: {
    type: Boolean,
    default: true
  }
});

const chartRef = ref(null);
let chart = null;

const initChart = () => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value);
    
    // 设置图表交互选项
    const option = {
      ...props.option,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#999'
          }
        }
      },
      toolbox: {
        feature: {
          dataZoom: {
            yAxisIndex: 'none'
          },
          dataView: {
            readOnly: false
          },
          magicType: {
            type: ['line', 'bar']
          },
          restore: {},
          saveAsImage: {}
        }
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        },
        {
          start: 0,
          end: 100
        }
      ],
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      }
    };
    
    chart.setOption(option);
  }
};

const resizeChart = () => {
  if (chart) {
    chart.resize();
  }
};

watch(() => props.option, (newOption) => {
  if (chart) {
    chart.setOption(newOption, true);
  }
}, { deep: true });

onMounted(() => {
  initChart();
  if (props.autoResize) {
    window.addEventListener('resize', resizeChart);
  }
});

onUnmounted(() => {
  if (chart) {
    chart.dispose();
  }
  if (props.autoResize) {
    window.removeEventListener('resize', resizeChart);
  }
});
</script>

<style scoped>
.chart-container {
  position: relative;
}
</style>