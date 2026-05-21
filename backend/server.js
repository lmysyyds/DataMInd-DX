require('dotenv').config();
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Scraper = require('./services/scraper');
const AIService = require('./services/aiService');
const cacheService = require('./services/cacheService');
const fileParser = require('./services/fileParser');
const dataStorage = require('./services/dataStorage');

// 任务队列管理
class TaskQueue {
  constructor(maxConcurrent = 3, maxRetries = 3) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
    this.maxRetries = maxRetries;
    this.tasks = new Map(); // 存储任务状态
  }

  addTask(taskId, taskFn, retries = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskId, taskFn, resolve, reject, retries });
      this.tasks.set(taskId, { status: 'pending', progress: 0, retries });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const { taskId, taskFn, resolve, reject, retries } = this.queue.shift();
    this.running++;
    this.tasks.set(taskId, { status: 'running', progress: 0, retries });

    try {
      // 设置任务超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), 5 * 60 * 1000); // 5分钟超时
      });

      const result = await Promise.race([taskFn(), timeoutPromise]);
      this.tasks.set(taskId, { status: 'completed', progress: 100, retries });
      resolve(result);
    } catch (error) {
      console.error(`Task ${taskId} failed (${retries + 1}/${this.maxRetries}):`, error);
      
      if (retries < this.maxRetries - 1) {
        // 自动重试
        console.log(`Retrying task ${taskId} (${retries + 2}/${this.maxRetries})...`);
        this.addTask(taskId, taskFn, retries + 1)
          .then(resolve)
          .catch(reject);
      } else {
        // 达到最大重试次数，任务失败
        this.tasks.set(taskId, { status: 'failed', progress: 0, error: error.message, retries });
        reject(error);
      }
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  getTaskStatus(taskId) {
    return this.tasks.get(taskId) || { status: 'not_found', progress: 0 };
  }

  updateTaskProgress(taskId, progress) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.progress = progress;
      this.tasks.set(taskId, { ...task });
    }
  }
}

// 创建全局任务队列
const taskQueue = new TaskQueue();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// multer配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB文件大小限制
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式，仅支持Excel、CSV和TXT文件'));
    }
  }
});

// 模拟数据
const mockData = {
  dashboard: {
    totalProducts: 1234,
    averagePrice: 128.5,
    competitorCount: 45,
    marketShare: 23.5
  },
  tasks: [
    { id: 1, name: '淘宝竞品监控', status: 'running', progress: 75 },
    { id: 2, name: '行业数据分析', status: 'pending', progress: 0 },
    { id: 3, name: '价格趋势分析', status: 'completed', progress: 100 }
  ]
};

// 路由
app.get('/api/dashboard', (req, res) => {
  res.json(mockData.dashboard);
});

app.get('/api/tasks', (req, res) => {
  res.json(mockData.tasks);
});

app.post('/api/tasks', (req, res) => {
  const newTask = {
    id: mockData.tasks.length + 1,
    name: req.body.name,
    status: 'pending',
    progress: 0
  };
  mockData.tasks.push(newTask);
  res.json(newTask);
});

app.post('/api/scrape', async (req, res) => {
  const { keyword, pageCount = 1 } = req.body;
  
  // 参数验证
  if (!keyword || keyword.trim() === '') {
    return res.json({ success: false, error: '关键词不能为空' });
  }
  
  if (keyword.length > 50) {
    return res.json({ success: false, error: '关键词长度不能超过50个字符' });
  }
  
  const pageCountNum = parseInt(pageCount);
  if (isNaN(pageCountNum) || pageCountNum <= 0) {
    return res.json({ success: false, error: '页数必须是正整数' });
  }
  
  if (pageCountNum > 100) {
    return res.json({ success: false, error: '页数不能超过100页' });
  }
  
  // 生成缓存键
  const cacheKey = cacheService.generateKey('scrape', keyword, pageCount);
  
  // 尝试从缓存获取数据
  const cachedResults = await cacheService.get(cacheKey);
  if (cachedResults) {
    console.log('Cache hit for scrape:', keyword);
    return res.json({ success: true, data: cachedResults, fromCache: true });
  }
  
  console.log('Cache miss for scrape:', keyword);
  
  // 生成任务ID
  const taskId = Date.now().toString();
  
  // 立即返回任务ID，开始后台处理
  res.json({ success: true, taskId });
  
  // 后台处理采集任务
  (async () => {
    try {
      // 添加到任务队列
      const results = await taskQueue.addTask(taskId, async () => {
        let scraper = null;
        try {
          scraper = new Scraper();
          await scraper.init();
          
          // 平滑进度更新
          const totalPages = pageCountNum;
          const totalSteps = totalPages * 10; // 每个页面分10步更新
          
          for (let i = 1; i <= totalPages; i++) {
            // 页面内的进度更新
            for (let step = 1; step <= 10; step++) {
              const progress = Math.floor(((i - 1) * 10 + step) / totalSteps * 90); // 90% 用于采集
              taskQueue.updateTaskProgress(taskId, progress);
              
              // 广播进度更新
              wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'scrapeProgress',
                    taskId,
                    progress,
                    message: `正在采集第 ${i} 页 (${step * 10}%)`
                  }));
                }
              });
              
              // 短暂延迟，使进度条更新更加平滑
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          // 实际采集
          const results = await scraper.scrapeTaobaoCeramics(keyword, pageCountNum);
          await scraper.close();
          
          // 缓存结果，有效期1小时
          await cacheService.set(cacheKey, results, 3600);
          
          // 更新进度为100%
          taskQueue.updateTaskProgress(taskId, 100);
          
          // 广播完成消息
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'scrapeComplete',
                taskId,
                result: { success: true, data: results }
              }));
            }
          });
          
          return results;
        } catch (error) {
          if (scraper) {
            try {
              await scraper.close();
            } catch (closeError) {
              console.error('Error closing scraper:', closeError);
            }
          }
          throw error;
        }
      });
      
      console.log(`Scraping completed for task ${taskId}`);
    } catch (error) {
      console.error(`Scraping error for task ${taskId}:`, error);
      
      // 广播错误消息
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'scrapeComplete',
            taskId,
            result: { success: false, error: error.message }
          }));
        }
      });
    }
  })();
});

// 获取任务状态
app.get('/api/scrape/status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const status = taskQueue.getTaskStatus(taskId);
  res.json({ success: true, status });
});

app.post('/api/ai/clean', async (req, res) => {
  const { data, model = 'minimax' } = req.body;
  
  // 生成缓存键（使用数据的哈希值）
  const dataHash = JSON.stringify(data).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0).toString();
  const cacheKey = cacheService.generateKey('ai:clean', model, dataHash);
  
  // 尝试从缓存获取数据
  const cachedResult = await cacheService.get(cacheKey);
  if (cachedResult) {
    console.log('Cache hit for AI cleaning');
    return res.json({ success: true, data: cachedResult, fromCache: true });
  }
  
  console.log('Cache miss for AI cleaning');
  
  const aiService = new AIService();
  
  try {
    const cleanedData = await aiService.cleanData(data, model);
    
    // 缓存结果，有效期1小时
    await cacheService.set(cacheKey, cleanedData, 3600);
    
    res.json({ success: true, data: cleanedData });
  } catch (error) {
    console.error('AI cleaning error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/ai/analyze', async (req, res) => {
  const { data, model = 'kimi' } = req.body;
  
  // 生成缓存键（使用数据的哈希值）
  const dataHash = JSON.stringify(data).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0).toString();
  const cacheKey = cacheService.generateKey('ai:analyze', model, dataHash);
  
  // 尝试从缓存获取数据
  const cachedResult = await cacheService.get(cacheKey);
  if (cachedResult) {
    console.log('Cache hit for AI analysis');
    return res.json({ success: true, data: cachedResult, fromCache: true });
  }
  
  console.log('Cache miss for AI analysis');
  
  const aiService = new AIService();
  
  try {
    const analysis = await aiService.analyzeData(data, model);
    
    // 缓存结果，有效期2小时
    await cacheService.set(cacheKey, analysis, 7200);
    
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/ai/natural-language', async (req, res) => {
  const { query } = req.body;
  
  // 生成缓存键
  const cacheKey = cacheService.generateKey('ai:natural-language', query);
  
  // 尝试从缓存获取数据
  const cachedResult = await cacheService.get(cacheKey);
  if (cachedResult) {
    console.log('Cache hit for AI natural language');
    return res.json({ success: true, data: cachedResult, fromCache: true });
  }
  
  console.log('Cache miss for AI natural language');
  
  const aiService = new AIService();
  
  try {
    const result = await aiService.naturalLanguageToChart(query);
    
    // 缓存结果，有效期24小时
    await cacheService.set(cacheKey, result, 86400);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('AI natural language error:', error);
    res.json({ success: false, error: error.message });
  }
});

// 导入API接口
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, error: '请选择要上传的文件' });
    }
    
    // 检查文件是否为空
    const stats = fs.statSync(req.file.path);
    if (stats.size === 0) {
      fs.unlinkSync(req.file.path);
      return res.json({ success: false, error: '上传的文件为空' });
    }
    
    const { importType, separator = '\t' } = req.body || { importType: 'append', separator: '\t' };
    const filePath = req.file.path;
    
    // 生成导入任务ID
    const taskId = Date.now().toString();
    
    // 立即返回任务ID，开始后台处理
    res.json({ success: true, taskId });
    
    // 后台处理导入
    (async () => {
      try {
        // 1. 读取文件大小，用于计算进度
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        
        // 2. 解析文件，模拟进度
        let progress = 0;
        
        // 发送初始进度
        broadcastImportProgress(taskId, progress, '开始解析文件...');
        
        // 模拟文件读取进度
        await new Promise(resolve => {
          let processed = 0;
          const chunkSize = 1024 * 1024; // 1MB
          
          const interval = setInterval(() => {
            processed += chunkSize;
            progress = Math.min(30, Math.floor((processed / fileSize) * 30));
            broadcastImportProgress(taskId, progress, '读取文件中...');
            
            if (processed >= fileSize) {
              clearInterval(interval);
              resolve();
            }
          }, 200);
        });
        
        // 3. 解析文件
        broadcastImportProgress(taskId, 30, '解析文件中...');
        const parsedData = await fileParser.parseFile(filePath, { separator });
        
        // 4. 处理数据
        broadcastImportProgress(taskId, 60, '处理数据中...');
        
        // 检查数据量限制
        if (parsedData.length > 100000) {
          throw new Error('导入数据量超过限制，最多支持10万条记录');
        }
        
        // 存储数据
        const storageResult = dataStorage.importData(parsedData, importType);
        if (!storageResult.success) {
          throw new Error(storageResult.error || '数据存储失败');
        }
        
        // 模拟数据处理进度
        await new Promise(resolve => {
          let processed = 0;
          const total = parsedData.length;
          
          const interval = setInterval(() => {
            processed += Math.min(100, total - processed);
            progress = 60 + Math.floor((processed / total) * 30);
            broadcastImportProgress(taskId, progress, '处理数据中...');
            
            if (processed >= total) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });
        
        // 5. 清理文件
        broadcastImportProgress(taskId, 90, '清理临时文件...');
        fs.unlinkSync(filePath);
        
        // 6. 完成
        broadcastImportProgress(taskId, 100, '导入完成！');
        
        // 发送完成消息
        broadcastImportComplete(taskId, {
          success: true,
          message: `数据导入成功，共导入${storageResult.newRecords}条记录，总记录数${storageResult.totalRecords}条`,
          data: parsedData,
          storageResult
        });
        
      } catch (error) {
        console.error('Import error:', error);
        
        // 清理上传的文件
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.error('Error deleting file:', unlinkError);
          }
        }
        
        // 发送错误消息
        broadcastImportComplete(taskId, {
          success: false,
          error: error.message
        });
      }
    })();
    
  } catch (error) {
    console.error('Import error:', error);
    
    // 清理上传的文件
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    
    res.json({ success: false, error: error.message });
  }
});

// 广播导入进度
function broadcastImportProgress(taskId, progress, message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'importProgress',
        taskId,
        progress,
        message
      }));
    }
  });
}

// 广播导入完成
function broadcastImportComplete(taskId, result) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'importComplete',
        taskId,
        result
      }));
    }
  });
}

// 获取导入历史
app.get('/api/import/history', (req, res) => {
  try {
    const history = dataStorage.getImportHistory();
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error getting import history:', error);
    res.json({ success: false, error: error.message });
  }
});

// SSE流式输出
app.get('/api/ai/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // 模拟AI分析过程的流式输出
  const messages = [
    '正在分析数据...',
    '提取关键特征...',
    '生成分析结果...',
    '绘制图表...',
    '分析完成！'
  ];
  
  let index = 0;
  const interval = setInterval(() => {
    if (index < messages.length) {
      res.write(`data: ${JSON.stringify({ message: messages[index], progress: (index + 1) * 20 })}\n\n`);
      index++;
    } else {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ complete: true })}\n\n`);
      res.end();
    }
  }, 1000);
  
  // 客户端断开连接时清理
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// WebSocket处理
wss.on('connection', (ws) => {
  console.log('WebSocket connected');
  
  // 发送初始数据
  ws.send(JSON.stringify({ type: 'dashboard', data: mockData.dashboard }));
  
  ws.on('message', (message) => {
    console.log('Received:', message);
  });
  
  ws.on('close', () => {
    console.log('WebSocket disconnected');
  });
});

// 模拟任务进度更新
setInterval(() => {
  mockData.tasks.forEach(task => {
    if (task.status === 'running' && task.progress < 100) {
      task.progress += 5;
      if (task.progress >= 100) {
        task.status = 'completed';
      }
      // 广播进度更新
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'taskUpdate', data: task }));
        }
      });
    }
  });
}, 2000);

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});