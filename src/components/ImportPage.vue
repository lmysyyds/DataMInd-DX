<template>
  <div class="import-page">
    <h2>数据导入</h2>
    <div class="import-container">
      <div class="file-upload">
        <h3>上传文件</h3>
        <p>支持格式：Excel (.xlsx/.xls)、CSV (.csv)、TXT (.txt)</p>
        <p>文件大小限制：10MB</p>
        <input 
          type="file" 
          ref="fileInput" 
          @change="handleFileChange" 
          accept=".xlsx,.xls,.csv,.txt"
          class="file-input"
        />
        <div v-if="selectedFile" class="file-info">
          <span>{{ selectedFile.name }}</span>
          <button @click="clearFile" class="clear-btn">清除</button>
        </div>
        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
      
      <div class="import-options">
        <h3>导入选项</h3>
        <div class="option-group">
          <label>
            <input type="radio" v-model="importType" value="replace" />
            替换现有数据
          </label>
          <label>
            <input type="radio" v-model="importType" value="append" />
            追加到现有数据
          </label>
        </div>
        <div class="option-group" v-if="selectedFile && selectedFile.name.endsWith('.txt')">
          <label>TXT文件分隔符：</label>
          <select v-model="txtSeparator">
            <option value="\t">制表符</option>
            <option value=",">逗号</option>
            <option value=";">分号</option>
            <option value=" ">空格</option>
          </select>
        </div>
      </div>
      
      <div class="import-actions">
        <button 
          @click="importData" 
          :disabled="!selectedFile || isLoading"
          class="import-btn"
        >
          {{ isLoading ? '导入中...' : '开始导入' }}
        </button>
        <button @click="cancelImport" class="cancel-btn">取消</button>
      </div>
      
      <div v-if="importProgress > 0" class="import-progress">
        <div class="progress-bar">
          <div class="progress" :style="{ width: importProgress + '%' }"></div>
        </div>
        <div class="progress-info">
          <span>{{ importProgress }}%</span>
          <span class="progress-message">{{ importMessage }}</span>
        </div>
      </div>
      
      <div v-if="importResult" class="import-result" :class="importResult.success ? 'success' : 'error'">
        <div class="result-header">
          <h4>{{ importResult.success ? '导入成功' : '导入失败' }}</h4>
          <button @click="closeResult" class="close-btn">×</button>
        </div>
        <p class="result-message">{{ importResult.message }}</p>
        
        <div v-if="importResult.success && importResult.storageResult" class="storage-info">
          <h5>存储信息</h5>
          <ul>
            <li>新导入记录: {{ importResult.storageResult.newRecords }}条</li>
            <li>总记录数: {{ importResult.storageResult.totalRecords }}条</li>
          </ul>
        </div>
        
        <div v-if="importResult.data" class="imported-data">
          <h5>导入数据预览</h5>
          <div class="data-preview">
            <table>
              <thead>
                <tr>
                  <th v-for="(header, index) in Object.keys(importResult.data[0])" :key="index">
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in importResult.data.slice(0, 5)" :key="index">
                  <td v-for="(value, key) in item" :key="key">
                    {{ value }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="preview-note">仅显示前5条数据</p>
          </div>
        </div>
      </div>
      
      <!-- 导入历史 -->
      <div class="import-history">
        <h3>导入历史</h3>
        <div v-if="importHistory.length === 0" class="empty-history">
          暂无导入历史
        </div>
        <div v-else class="history-list">
          <div v-for="(item, index) in importHistory" :key="index" class="history-item">
            <div class="history-time">{{ formatDate(item.timestamp) }}</div>
            <div class="history-info">
              <span class="history-type">{{ item.importType === 'replace' ? '替换' : '追加' }}</span>
              <span class="history-records">导入 {{ item.records }} 条记录</span>
              <span class="history-total">总记录数: {{ item.totalRecords }}条</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const fileInput = ref(null);
const selectedFile = ref(null);
const error = ref('');
const isLoading = ref(false);
const importProgress = ref(0);
const importResult = ref(null);
const importType = ref('append');
const currentTaskId = ref(null);
const importMessage = ref('');
const txtSeparator = ref('\t');
const importHistory = ref([]);
let ws = null;

// WebSocket连接
const connectWebSocket = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const wsUrl = apiBaseUrl.replace('http', 'ws');
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'importProgress' && data.taskId === currentTaskId.value) {
        importProgress.value = data.progress;
        importMessage.value = data.message;
      } else if (data.type === 'importComplete' && data.taskId === currentTaskId.value) {
        importResult.value = data.result;
        isLoading.value = false;
        currentTaskId.value = null;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
};

// 关闭导入结果
const closeResult = () => {
  importResult.value = null;
};

// 格式化日期
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// 获取导入历史
const fetchImportHistory = async () => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const response = await fetch(`${apiBaseUrl}/api/import/history`);
    const result = await response.json();
    if (result.success) {
      // 按时间倒序排序，最新的记录显示在最前面
      importHistory.value = result.data.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    }
  } catch (error) {
    console.error('Error fetching import history:', error);
  }
};

onMounted(() => {
  connectWebSocket();
  fetchImportHistory();
});

onUnmounted(() => {
  if (ws) {
    ws.close();
  }
});

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    const allowedTypes = ['.xlsx', '.xls', '.csv', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    // 检查文件格式
    if (!allowedTypes.includes(fileExtension)) {
      error.value = '不支持的文件格式，请上传 Excel、CSV 或 TXT 文件';
      selectedFile.value = null;
      return;
    }
    
    // 检查文件大小
    if (file.size > maxSize) {
      error.value = '文件大小超过限制，请上传小于 10MB 的文件';
      selectedFile.value = null;
      return;
    }
    
    selectedFile.value = file;
    error.value = '';
  }
};

const clearFile = () => {
  selectedFile.value = null;
  error.value = '';
  importResult.value = null;
  importProgress.value = 0;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const cancelImport = () => {
  clearFile();
};

const importData = async () => {
  if (!selectedFile.value) return;
  
  isLoading.value = true;
  error.value = '';
  importProgress.value = 0;
  importResult.value = null;
  importMessage.value = '';
  
  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    formData.append('importType', importType.value);
    formData.append('separator', txtSeparator.value);
    
    // 实际项目中这里会调用后端API
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const response = await fetch(`${apiBaseUrl}/api/import`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success && result.taskId) {
      // 保存任务ID，用于接收进度
      currentTaskId.value = result.taskId;
    } else {
      // 直接返回错误
      importResult.value = result;
      isLoading.value = false;
    }
    
    // 重新获取导入历史
    setTimeout(() => {
      fetchImportHistory();
    }, 1000);
    
  } catch (err) {
    isLoading.value = false;
    error.value = '导入失败: ' + err.message;
  }
};
</script>

<style scoped>
.import-page {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 80vh;
}

.import-container {
  max-width: 800px;
  margin: 0 auto;
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.file-upload {
  margin-bottom: 30px;
}

.file-upload h3 {
  margin-bottom: 10px;
  color: #333;
}

.file-upload p {
  margin-bottom: 15px;
  color: #666;
  font-size: 14px;
}

.file-input {
  margin-bottom: 15px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100%;
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background-color: #f0f8ff;
  border: 1px solid #b8e1ff;
  border-radius: 4px;
  margin-bottom: 15px;
}

.clear-btn {
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.clear-btn:hover {
  background-color: #e0e0e0;
}

.error-message {
  color: #ff4d4f;
  font-size: 14px;
  margin-top: 10px;
}

.import-options {
  margin-bottom: 30px;
}

.import-options h3 {
  margin-bottom: 15px;
  color: #333;
}

.option-group {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  align-items: center;
}

.option-group label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.option-group select {
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-left: 10px;
}

.import-actions {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
}

.import-btn {
  background-color: #1890ff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.import-btn:hover:not(:disabled) {
  background-color: #40a9ff;
}

.import-btn:disabled {
  background-color: #d9d9d9;
  cursor: not-allowed;
}

.cancel-btn {
  background-color: white;
  color: #333;
  border: 1px solid #ddd;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn:hover {
  background-color: #f5f5f5;
}

.import-progress {
  margin-bottom: 30px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background-color: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress {
  height: 100%;
  background-color: #1890ff;
  border-radius: 10px;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-message {
  font-size: 14px;
  color: #666;
  margin-left: 10px;
}

.import-result {
  padding: 20px;
  border-radius: 4px;
  margin-top: 20px;
  position: relative;
}

.import-result.success {
  background-color: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #52c41a;
}

.import-result.error {
  background-color: #fff1f0;
  border: 1px solid #ffccc7;
  color: #ff4d4f;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.result-header h4 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: inherit;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.result-message {
  margin-bottom: 15px;
  font-size: 14px;
}

.storage-info {
  margin-bottom: 20px;
}

.storage-info h5 {
  margin-bottom: 10px;
  color: #333;
}

.storage-info ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.storage-info li {
  margin-bottom: 5px;
  font-size: 14px;
}

.import-history {
  margin-top: 40px;
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.import-history h3 {
  margin-bottom: 15px;
  color: #333;
}

.empty-history {
  text-align: center;
  color: #999;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.history-list {
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 10px;
  background-color: #f9f9f9;
}

.history-time {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.history-info {
  display: flex;
  gap: 20px;
  font-size: 14px;
}

.history-type {
  font-weight: 500;
  color: #1890ff;
}

.history-records {
  color: #52c41a;
}

.history-total {
  color: #fa8c16;
}

.imported-data {
  margin-top: 20px;
}

.imported-data h5 {
  margin-bottom: 10px;
  color: #333;
}

.data-preview {
  overflow-x: auto;
}

.data-preview table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}

.data-preview th,
.data-preview td {
  padding: 8px 12px;
  border: 1px solid #ddd;
  text-align: left;
}

.data-preview th {
  background-color: #f5f5f5;
  font-weight: 500;
}

.data-preview tr:hover {
  background-color: #f0f8ff;
}

.preview-note {
  font-size: 12px;
  color: #666;
  margin-top: 5px;
}
</style>