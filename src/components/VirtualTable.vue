<template>
  <div class="virtual-table" :style="{ height: height }">
    <div class="table-header">
      <div v-for="column in columns" :key="column.key" :style="{ width: column.width }">
        {{ column.title }}
      </div>
    </div>
    <div 
      class="table-body" 
      ref="tableBody"
      @scroll="handleScroll"
      :style="{ height: bodyHeight }"
    >
      <div 
        class="table-content" 
        :style="{ height: totalHeight }"
      >
        <div 
          v-for="item in visibleItems" 
          :key="item.id"
          class="table-row"
          :style="{ transform: `translateY(${getItemTop(item.index)}px)` }"
        >
          <div v-for="column in columns" :key="column.key" :style="{ width: column.width }">
            {{ item[column.key] }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  columns: {
    type: Array,
    required: true
  },
  height: {
    type: String,
    default: '400px'
  },
  rowHeight: {
    type: Number,
    default: 40
  }
});

const tableBody = ref(null);
const scrollTop = ref(0);

const bodyHeight = computed(() => {
  return props.height;
});

const totalHeight = computed(() => {
  return props.data.length * props.rowHeight + 'px';
});

const startIndex = computed(() => {
  return Math.max(0, Math.floor(scrollTop.value / props.rowHeight) - 2);
});

const endIndex = computed(() => {
  if (!tableBody.value) return props.data.length;
  const visibleHeight = tableBody.value.clientHeight;
  return Math.min(
    props.data.length,
    Math.ceil((scrollTop.value + visibleHeight) / props.rowHeight) + 2
  );
});

const visibleItems = computed(() => {
  return props.data
    .slice(startIndex.value, endIndex.value)
    .map((item, index) => ({
      ...item,
      index: startIndex.value + index
    }));
});

const getItemTop = (index) => {
  return index * props.rowHeight;
};

const handleScroll = (event) => {
  scrollTop.value = event.target.scrollTop;
};

// 监听数据变化，重置滚动位置
watch(() => props.data.length, () => {
  if (tableBody.value) {
    tableBody.value.scrollTop = 0;
    scrollTop.value = 0;
  }
});

onMounted(() => {
  // 初始化滚动位置
  if (tableBody.value) {
    scrollTop.value = tableBody.value.scrollTop;
  }
});
</script>

<style scoped>
.virtual-table {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.table-header {
  display: flex;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.table-header > div {
  padding: 12px;
  font-weight: bold;
  text-align: left;
  border-right: 1px solid #e0e0e0;
}

.table-header > div:last-child {
  border-right: none;
}

.table-body {
  overflow-y: auto;
  position: relative;
}

.table-content {
  position: relative;
  width: 100%;
}

.table-row {
  display: flex;
  position: absolute;
  width: 100%;
  border-bottom: 1px solid #e0e0e0;
  transition: background-color 0.2s;
}

.table-row:hover {
  background-color: #f0f8ff;
}

.table-row > div {
  padding: 12px;
  border-right: 1px solid #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-row > div:last-child {
  border-right: none;
}
</style>