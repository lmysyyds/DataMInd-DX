<template>
  <div class="app">
    <header class="header">
      <h1>DataMind 陶瓷电商数据平台</h1>
    </header>
    <main class="main">
      <div class="sidebar">
        <nav>
          <ul>
            <li @click="activeTab = 'dashboard'" :class="{ active: activeTab === 'dashboard' }">数据看板</li>
            <li @click="activeTab = 'collection'" :class="{ active: activeTab === 'collection' }">采集任务</li>
            <li @click="activeTab = 'import'" :class="{ active: activeTab === 'import' }">数据导入</li>
            <li @click="activeTab = 'analysis'" :class="{ active: activeTab === 'analysis' }">数据分析</li>
            <li @click="activeTab = 'export'" :class="{ active: activeTab === 'export' }">报表导出</li>
            <li @click="activeTab = 'settings'" :class="{ active: activeTab === 'settings' }">系统设置</li>
          </ul>
        </nav>
      </div>
      <div class="content">
        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
        <!-- 错误提示弹窗 -->
        <div v-if="error" class="error-popup">
          <div class="error-content">
            <p>{{ error }}</p>
            <button @click="error = ''">关闭</button>
          </div>
        </div>
        <!-- 数据看板 -->
        <div v-if="activeTab === 'dashboard'">
          <h2>数据看板</h2>
          <div class="dashboard-cards">
            <div class="card">
              <h3>总商品数</h3>
              <p>{{ dashboardData.totalProducts }}</p>
            </div>
            <div class="card">
              <h3>平均价格</h3>
              <p>¥{{ dashboardData.averagePrice }}</p>
            </div>
            <div class="card">
              <h3>竞品数量</h3>
              <p>{{ dashboardData.competitorCount }}</p>
            </div>
            <div class="card">
              <h3>市场份额</h3>
              <p>{{ dashboardData.marketShare }}%</p>
            </div>
          </div>
          <div class="chart-container">
            <LineChart :data="salesTrendData" xAxisKey="month" yAxisKey="sales" title="销量趋势" />
          </div>
        </div>

        <!-- 采集任务 -->
        <div v-if="activeTab === 'collection'">
          <h2>采集任务</h2>
          <div class="task-form">
            <input v-model="scrapeKeyword" placeholder="输入关键词" />
            <input type="number" v-model="scrapePageCount" placeholder="页数" />
            <button @click="startScrape">开始采集</button>
          </div>
          <div class="tasks-list">
            <div v-for="task in tasks" :key="task.id" class="task-item">
              <span>{{ task.name }}</span>
              <span class="status" :class="task.status">{{ task.status }}</span>
              <div class="progress-bar">
                <div class="progress" :style="{ width: task.progress + '%' }"></div>
              </div>
              <span>{{ task.progress }}%</span>
            </div>
          </div>
          <div v-if="scrapedData.length > 0" class="scraped-data">
            <h3>采集数据</h3>
            <VirtualTable 
              :data="scrapedData" 
              :columns="tableColumns" 
              height="500px"
            />
          </div>
        </div>

        <!-- 数据导入 -->
        <div v-if="activeTab === 'import'">
          <ImportPage />
        </div>

        <!-- 数据分析 -->
        <div v-if="activeTab === 'analysis'">
          <h2>数据分析</h2>
          <div class="analysis-section">
            <h3>价格分布</h3>
            <PieChart :data="priceDistributionData" title="价格分布" />
          </div>
          <div class="analysis-section">
            <h3>竞品对比</h3>
            <BarChart :data="competitorData" xAxisKey="name" yAxisKey="sales" title="竞品销量对比" />
          </div>
          <div class="ai-analysis">
            <h3>AI 分析</h3>
            <input v-model="aiQuery" placeholder="输入分析需求，如：分析价格分布" />
            <button @click="runAIAnalysis">分析</button>
            <div v-if="aiStreamStatus.message" class="ai-stream-status">
              <div class="progress-bar">
                <div class="progress" :style="{ width: aiStreamStatus.progress + '%' }"></div>
              </div>
              <span>{{ aiStreamStatus.message }}</span>
            </div>
            <div v-if="aiResult" class="ai-result">
              <h4>分析结果</h4>
              <div v-if="aiResult.chartType === 'pie'">
                <PieChart :data="aiResult.data" title="AI 生成图表" />
              </div>
              <div v-else-if="aiResult.chartType === 'line'">
                <LineChart :data="aiResult.data" xAxisKey="month" yAxisKey="sales" title="AI 生成图表" />
              </div>
              <div v-else-if="aiResult.chartType === 'bar'">
                <BarChart :data="aiResult.data" xAxisKey="name" yAxisKey="sales" title="AI 生成图表" />
              </div>
            </div>
          </div>
        </div>

        <!-- 报表导出 -->
        <div v-if="activeTab === 'export'">
          <h2>报表导出</h2>
          <div class="export-options">
            <button @click="exportExcel">导出 Excel</button>
            <button @click="exportPDF">导出 PDF</button>
          </div>
          <div v-if="exportProgress > 0" class="export-progress">
            <div class="progress-bar">
              <div class="progress" :style="{ width: exportProgress + '%' }"></div>
            </div>
            <span>导出进度: {{ exportProgress }}%</span>
          </div>
        </div>

        <!-- 系统设置 -->
        <div v-if="activeTab === 'settings'">
          <h2>系统设置</h2>
          <div class="settings-form">
            <div class="form-group">
              <label>API 密钥设置</label>
              <div class="api-key-input">
                <input 
                  type="text" 
                  v-model="apiKeys.minimax" 
                  placeholder="MiniMax API Key"
                  @blur="validateApiKey('minimax', apiKeys.minimax)"
                />
                <div v-if="apiErrors.minimax" class="error-message">{{ apiErrors.minimax }}</div>
              </div>
              <div class="api-key-input">
                <input 
                  type="text" 
                  v-model="apiKeys.kimi" 
                  placeholder="Kimi API Key"
                  @blur="validateApiKey('kimi', apiKeys.kimi)"
                />
                <div v-if="apiErrors.kimi" class="error-message">{{ apiErrors.kimi }}</div>
              </div>
              <div class="api-key-input">
                <input 
                  type="text" 
                  v-model="apiKeys.claude" 
                  placeholder="Claude API Key"
                  @blur="validateApiKey('claude', apiKeys.claude)"
                />
                <div v-if="apiErrors.claude" class="error-message">{{ apiErrors.claude }}</div>
              </div>
            </div>
            <button @click="saveSettings">保存设置</button>
          </div>
        </div>
      </div>
    </main>
    <footer class="footer">
      <p>© 2024 DataMind 陶瓷电商数据平台</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
// 组件懒加载 - 使用更高效的懒加载方式
const LineChart = defineAsyncComponent({
  loader: () => import('./components/charts/LineChart.vue'),
  loadingComponent: { template: '<div class="chart-loading">加载中...</div>' },
  errorComponent: { template: '<div class="chart-error">加载失败</div>' },
  delay: 200,
  timeout: 3000
});

const BarChart = defineAsyncComponent({
  loader: () => import('./components/charts/BarChart.vue'),
  loadingComponent: { template: '<div class="chart-loading">加载中...</div>' },
  errorComponent: { template: '<div class="chart-error">加载失败</div>' },
  delay: 200,
  timeout: 3000
});

const PieChart = defineAsyncComponent({
  loader: () => import('./components/charts/PieChart.vue'),
  loadingComponent: { template: '<div class="chart-loading">加载中...</div>' },
  errorComponent: { template: '<div class="chart-error">加载失败</div>' },
  delay: 200,
  timeout: 3000
});

const VirtualTable = defineAsyncComponent({
  loader: () => import('./components/VirtualTable.vue'),
  loadingComponent: { template: '<div class="table-loading">加载中...</div>' },
  errorComponent: { template: '<div class="table-error">加载失败</div>' },
  delay: 200,
  timeout: 3000
});

const ImportPage = defineAsyncComponent({
  loader: () => import('./components/ImportPage.vue'),
  loadingComponent: { template: '<div class="page-loading">加载中...</div>' },
  errorComponent: { template: '<div class="page-error">加载失败</div>' },
  delay: 200,
  timeout: 3000
});
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { storageUtils } from './utils';

// 状态管理
const activeTab = ref('dashboard');
const isLoading = ref(false);
const error = ref('');
let errorTimer = null;
const apiKeys = ref({
  minimax: '',
  kimi: '',
  claude: ''
});
const apiErrors = ref({
  minimax: '',
  kimi: '',
  claude: ''
});
const dashboardData = ref({
  totalProducts: 1234,
  averagePrice: 128.5,
  competitorCount: 45,
  marketShare: 23.5
});
const tasks = ref([
  { id: 1, name: '淘宝竞品监控', status: 'running', progress: 75 },
  { id: 2, name: '行业数据分析', status: 'pending', progress: 0 },
  { id: 3, name: '价格趋势分析', status: 'completed', progress: 100 }
]);
const scrapeKeyword = ref('陶瓷杯');
const scrapePageCount = ref(1);
const exportProgress = ref(0);
const aiQuery = ref('');
const aiResult = ref(null);
const aiStreamStatus = ref({});
const scrapedData = ref([]);

// 表格列定义
const tableColumns = [
  { key: 'id', title: 'ID', width: '80px' },
  { key: 'title', title: '商品名称', width: '300px' },
  { key: 'price', title: '价格', width: '100px' },
  { key: 'sales', title: '销量', width: '100px' },
  { key: 'shop', title: '店铺', width: '200px' },
  { key: 'location', title: '地区', width: '100px' }
];

// 模拟数据
const salesTrendData = [
  { month: '1月', sales: 1200 },
  { month: '2月', sales: 1500 },
  { month: '3月', sales: 1800 },
  { month: '4月', sales: 1600 },
  { month: '5月', sales: 2000 },
  { month: '6月', sales: 2200 }
];

const priceDistributionData = [
  { name: '0-50元', value: 25 },
  { name: '51-100元', value: 35 },
  { name: '101-200元', value: 20 },
  { name: '201-500元', value: 15 },
  { name: '500+元', value: 5 }
];

const competitorData = [
  { name: '竞品A', price: 120, sales: 1500 },
  { name: '竞品B', price: 150, sales: 1200 },
  { name: '竞品C', price: 180, sales: 1000 },
  { name: '我们', price: 130, sales: 1800 }
];

// 方法
const setError = (message) => {
  console.log('Setting error:', message);
  // 清除之前的定时器
  if (errorTimer) {
    console.log('Clearing previous timer:', errorTimer);
    clearTimeout(errorTimer);
  }
  // 设置错误信息
  error.value = message;
  console.log('Error value set to:', error.value);
  // 5秒后自动清除错误信息
  errorTimer = setTimeout(() => {
    console.log('Auto-clearing error');
    error.value = '';
    console.log('Error value cleared to:', error.value);
  }, 5000);
  console.log('Timer set:', errorTimer);
};

// API密钥验证函数
const validateApiKey = (type, value) => {
  if (!value) {
    apiErrors.value[type] = '';
    return;
  }
  
  // 简单的API密钥格式验证
  // 实际项目中，应根据不同API提供商的要求进行验证
  if (value.length < 10) {
    apiErrors.value[type] = 'API密钥长度不足';
  } else {
    apiErrors.value[type] = '';
  }
};

// 保存设置
const saveSettings = () => {
  // 验证所有API密钥
  Object.keys(apiKeys.value).forEach(key => {
    validateApiKey(key, apiKeys.value[key]);
  });
  
  // 检查是否有错误
  const hasErrors = Object.values(apiErrors.value).some(error => error);
  if (hasErrors) {
    setError('请检查API密钥格式');
    return;
  }
  
  // 模拟保存设置
  isLoading.value = true;
  setTimeout(() => {
    // 实际项目中，这里会调用API保存设置
    setError('设置保存成功');
    isLoading.value = false;
  }, 1000);
};

const startScrape = async () => {
  // 参数验证
  if (!scrapeKeyword.value || scrapeKeyword.value.trim() === '') {
    setError('请输入关键词');
    return;
  }
  
  if (scrapeKeyword.value.length > 50) {
    setError('关键词长度不能超过50个字符');
    return;
  }
  
  const pageCount = parseInt(scrapePageCount.value);
  if (isNaN(pageCount) || pageCount <= 0) {
    setError('请输入有效的页数');
    return;
  }
  
  if (pageCount > 100) {
    setError('页数不能超过100页');
    return;
  }
  
  isLoading.value = true;
  error.value = '';
  
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const response = await fetch(`${apiBaseUrl}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ keyword: scrapeKeyword.value, pageCount })
    });
    
    const result = await response.json();
    
    if (result.success && result.taskId) {
      // 创建新任务
      const newTask = {
        id: tasks.value.length + 1,
        taskId: result.taskId,
        name: `采集: ${scrapeKeyword.value}`,
        status: 'running',
        progress: 0
      };
      tasks.value.push(newTask);
      
      // 监听WebSocket消息
      if (ws) {
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'scrapeProgress' && data.taskId === result.taskId) {
              // 更新任务进度
              const task = tasks.value.find(t => t.taskId === result.taskId);
              if (task) {
                task.progress = data.progress;
                task.status = 'running';
              }
            } else if (data.type === 'scrapeComplete' && data.taskId === result.taskId) {
              // 采集完成
              const task = tasks.value.find(t => t.taskId === result.taskId);
              if (task) {
                task.status = 'completed';
                task.progress = 100;
              }
              
              if (data.result.success) {
                // 如果采集结果为空，生成模拟数据
                if (data.result.data && data.result.data.length > 0) {
                  scrapedData.value = data.result.data;
                } else {
                  // 生成模拟数据，测试虚拟滚动表格
                  const mockData = [];
                  for (let i = 1; i <= 10000; i++) {
                    mockData.push({
                      id: i,
                      title: `陶瓷杯 ${i} - 高质量陶瓷水杯`,
                      price: (Math.random() * 200 + 50).toFixed(2),
                      sales: Math.floor(Math.random() * 10000),
                      shop: `陶瓷专卖店 ${Math.floor(Math.random() * 100)}`,
                      location: ['景德镇', '德化', '潮州', '龙泉', '唐山'][Math.floor(Math.random() * 5)]
                    });
                  }
                  scrapedData.value = mockData;
                }
              } else {
                error.value = '采集失败: ' + data.result.error;
              }
              
              isLoading.value = false;
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        };
      }
    } else {
      isLoading.value = false;
      error.value = '创建采集任务失败: ' + (result.error || '未知错误');
    }
    
  } catch (err) {
    console.error('Error starting scrape:', err);
    setError('启动采集任务失败: ' + err.message);
      isLoading.value = false;
  }
};

const runAIAnalysis = async () => {
  isLoading.value = true;
  error.value = '';
  
  try {
    // 模拟AI分析
    aiResult.value = null;
    aiStreamStatus.value = { message: '开始分析...', progress: 0 };
    
    // 实际项目中这里会调用后端API
    /*
    try {
      const response = await fetch('/api/ai/natural-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: aiQuery.value
        })
      });
      const result = await response.json();
      if (result.success) {
        aiResult.value = result.data;
      } else {
        throw new Error(result.error || 'AI分析失败');
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      error.value = 'AI分析失败: ' + error.message;
    } finally {
      isLoading.value = false;
    }
    */
    
    // 模拟AI分析结果
    setTimeout(() => {
      aiResult.value = {
        chartType: 'pie',
        title: 'AI 分析结果',
        data: priceDistributionData
      };
      aiStreamStatus.value = { message: '分析完成！', progress: 100 };
      isLoading.value = false;
    }, 1500);
    
    // 实际项目中这里会使用SSE
    /*
    const eventSource = new EventSource('/api/ai/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.complete) {
          eventSource.close();
          isLoading.value = false;
        } else {
          aiStreamStatus.value = data;
        }
      } catch (error) {
        console.error('SSE message error:', error);
        eventSource.close();
        isLoading.value = false;
        error.value = 'SSE流处理失败: ' + error.message;
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
      isLoading.value = false;
      error.value = 'SSE连接失败: ' + error.message;
    };
    */
  } catch (err) {
    console.error('Error running AI analysis:', err);
    setError('启动AI分析失败: ' + err.message);
    isLoading.value = false;
  }
};

const exportExcel = () => {
  isLoading.value = true;
  error.value = '';
  
  try {
    // 模拟导出进度
    exportProgress.value = 0;
    const interval = setInterval(() => {
      exportProgress.value += 20;
      if (exportProgress.value >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          exportProgress.value = 0;
          isLoading.value = false;
        }, 2000);
      }
    }, 500);
    
    // 实际导出逻辑
    setTimeout(() => {
      try {
        const data = [
          ['商品名称', '价格', '销量', '店铺', '地区'],
          ...competitorData.map(item => [item.name, item.price, item.sales, '店铺A', '杭州'])
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '竞品数据');
        
        // 添加时间戳确保文件名唯一性
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        XLSX.writeFile(wb, `陶瓷电商数据_${timestamp}.xlsx`);
      } catch (err) {
        console.error('Excel export error:', err);
        setError('Excel导出失败: ' + err.message);
        isLoading.value = false;
      }
    }, 1000);
  } catch (err) {
    console.error('Error starting Excel export:', err);
    setError('启动Excel导出失败: ' + err.message);
    isLoading.value = false;
  }
};

const exportPDF = () => {
  isLoading.value = true;
  error.value = '';
  
  try {
    // 模拟导出进度
    exportProgress.value = 0;
    const interval = setInterval(() => {
      exportProgress.value += 15;
      if (exportProgress.value >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          exportProgress.value = 0;
          isLoading.value = false;
        }, 2000);
      }
    }, 500);
    
    // 实际导出逻辑
    setTimeout(() => {
      try {
        const content = document.querySelector('.content');
        if (content) {
          html2canvas(content).then(canvas => {
            try {
              const imgData = canvas.toDataURL('image/png');
              const pdf = new jsPDF('p', 'mm', 'a4');
              const imgWidth = 210;
              const imgHeight = canvas.height * imgWidth / canvas.width;
              
              pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
              // 添加时间戳确保文件名唯一性
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              pdf.save(`陶瓷电商数据_${timestamp}.pdf`);
            } catch (err) {
              console.error('PDF creation error:', err);
              setError('PDF创建失败: ' + err.message);
              isLoading.value = false;
            }
          }).catch(err => {
            console.error('Canvas capture error:', err);
            setError('页面截图失败: ' + err.message);
            isLoading.value = false;
          });
        } else {
          throw new Error('未找到导出内容');
        }
      } catch (err) {
        console.error('PDF export error:', err);
        setError('PDF导出失败: ' + err.message);
        isLoading.value = false;
      }
    }, 1000);
  } catch (err) {
    console.error('Error starting PDF export:', err);
    setError('启动PDF导出失败: ' + err.message);
    isLoading.value = false;
  }
};

// WebSocket连接
let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000; // 3秒

// 建立WebSocket连接
const connectWebSocket = () => {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  
  ws = new WebSocket('ws://localhost:8080');
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    reconnectAttempts = 0; // 重置重连次数
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'dashboard') {
        dashboardData.value = data.data;
      } else if (data.type === 'taskUpdate') {
        const task = tasks.value.find(t => t.id === data.data.id);
        if (task) {
          task.status = data.data.status;
          task.progress = data.data.progress;
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // 尝试重连
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
      setTimeout(connectWebSocket, reconnectDelay);
    } else {
      console.error('Max reconnect attempts reached');
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
};

// 初始化
onMounted(() => {
  // 建立WebSocket连接
  connectWebSocket();
  
  // 实际项目中这里会从后端获取数据
});

// 组件卸载时关闭WebSocket连接
onUnmounted(() => {
  if (ws) {
    ws.close();
  }
});
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  background-color: #4CAF50;
  color: white;
  padding: 1rem;
  text-align: center;
}

.main {
  display: flex;
  flex: 1;
}

.sidebar {
  width: 200px;
  background-color: #f1f1f1;
  padding: 1rem;
}

.sidebar ul {
  list-style: none;
  padding: 0;
}

.sidebar li {
  margin: 0.5rem 0;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
}

.sidebar li:hover {
  background-color: #ddd;
}

.sidebar li.active {
  background-color: #4CAF50;
  color: white;
}

.content {
  flex: 1;
  padding: 2rem;
}

.dashboard-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.card {
  background-color: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.card h3 {
  margin: 0 0 0.5rem 0;
  color: #666;
}

.card p {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
}

.chart-container {
  margin-bottom: 2rem;
}

.task-form {
  margin-bottom: 1rem;
  display: flex;
  gap: 1rem;
}

.task-form input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.task-form button {
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.task-form button:hover {
  background-color: #45a049;
}

.tasks-list {
  margin-top: 1rem;
}

.task-item {
  background-color: #f9f9f9;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin-left: 1rem;
}

.status.running {
  background-color: #2196F3;
  color: white;
}

.status.pending {
  background-color: #ff9800;
  color: white;
}

.status.completed {
  background-color: #4CAF50;
  color: white;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  margin: 0.5rem 0;
  overflow: hidden;
}

.progress {
  height: 100%;
  background-color: #4CAF50;
  transition: width 0.3s ease;
}

.analysis-section {
  margin-bottom: 2rem;
}

.ai-analysis {
  margin-top: 2rem;
  padding: 1rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ai-analysis input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.ai-analysis button {
  padding: 0.5rem 1rem;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 1rem;
}

.ai-analysis button:hover {
  background-color: #1976D2;
}

.ai-result {
  margin-top: 1rem;
  max-height: 400px;
  overflow-y: auto;
  padding: 1rem;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.export-options {
  margin-bottom: 1rem;
}

.export-options button {
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 1rem;
}

.export-options button:hover {
  background-color: #45a049;
}

.export-progress {
  margin-top: 1rem;
}

.settings-form {
  margin-top: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.api-key-input {
  margin-bottom: 1rem;
}

.api-key-input .error-message {
  color: #ff4d4f;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.settings-form button {
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.settings-form button:hover {
  background-color: #45a049;
}

.footer {
  background-color: #333;
  color: white;
  text-align: center;
  padding: 1rem;
}

/* 懒加载相关样式 */
.chart-loading,
.table-loading,
.page-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
  background-color: #f9f9f9;
  border-radius: 8px;
  color: #666;
  font-size: 16px;
}

.chart-error,
.table-error,
.page-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
  background-color: #fff1f0;
  border-radius: 8px;
  color: #ff4d4f;
  font-size: 16px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  backdrop-filter: blur(3px);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  animation: fadeIn 0.3s ease;
}

.error-content {
  background-color: #ffdddd;
  border: 1px solid #f44336;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  width: 90%;
  text-align: center;
  animation: slideIn 0.3s ease;
}

.error-content p {
  margin: 0 0 1.5rem 0;
  color: #d32f2f;
  font-size: 1rem;
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.error-content button {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.3s ease;
}

.error-content button:hover {
  background-color: #d32f2f;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>