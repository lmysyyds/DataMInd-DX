// 通用工具包

// 数据处理工具
export const dataUtils = {
  // 格式化价格
  formatPrice(price) {
    return parseFloat(price).toFixed(2);
  },
  
  // 格式化销量
  formatSales(sales) {
    if (sales >= 10000) {
      return (sales / 10000).toFixed(1) + '万';
    }
    return sales;
  },
  
  // 数据分组
  groupBy(data, key) {
    return data.reduce((groups, item) => {
      const group = item[key];
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
      return groups;
    }, {});
  },
  
  // 数据排序
  sortBy(data, key, order = 'asc') {
    return data.sort((a, b) => {
      if (a[key] < b[key]) return order === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }
};

// 网络请求工具
export const httpUtils = {
  // GET请求
  async get(url, params = {}) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    
    const response = await fetch(fullUrl);
    return response.json();
  },
  
  // POST请求
  async post(url, data = {}) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  // SSE连接
  connectSSE(url, onMessage, onError) {
    const eventSource = new EventSource(url);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('SSE message error:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      if (onError) {
        onError(error);
      }
      eventSource.close();
    };
    
    return eventSource;
  }
};

// 日期时间工具
export const dateUtils = {
  // 格式化日期
  formatDate(date, format = 'YYYY-MM-DD') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },
  
  // 获取相对时间
  getRelativeTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    return this.formatDate(date);
  }
};

// 存储工具
export const storageUtils = {
  // 设置本地存储
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  
  // 获取本地存储
  get(key, defaultValue = null) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  },
  
  // 删除本地存储
  remove(key) {
    localStorage.removeItem(key);
  },
  
  // 清空本地存储
  clear() {
    localStorage.clear();
  }
};

// 工具函数集合
export default {
  ...dataUtils,
  ...httpUtils,
  ...dateUtils,
  ...storageUtils
};