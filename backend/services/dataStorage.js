const fs = require('fs');
const path = require('path');

class DataStorage {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.dataFile = path.join(this.dataDir, 'importedData.json');
    this.importHistoryFile = path.join(this.dataDir, 'importHistory.json');
    this.maxRecords = 100000; // 最大记录数限制
    
    // 确保数据目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // 初始化数据文件
    if (!fs.existsSync(this.dataFile)) {
      fs.writeFileSync(this.dataFile, JSON.stringify([]));
    }
    
    // 初始化导入历史文件
    if (!fs.existsSync(this.importHistoryFile)) {
      fs.writeFileSync(this.importHistoryFile, JSON.stringify([]));
    }
  }

  // 读取数据
  readData() {
    try {
      const data = fs.readFileSync(this.dataFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading data file:', error);
      return [];
    }
  }

  // 写入数据
  writeData(data) {
    try {
      // 限制数据量
      if (data.length > this.maxRecords) {
        data = data.slice(0, this.maxRecords);
      }
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Error writing data file:', error);
      return false;
    }
  }

  // 读取导入历史
  readImportHistory() {
    try {
      const history = fs.readFileSync(this.importHistoryFile, 'utf8');
      return JSON.parse(history);
    } catch (error) {
      console.error('Error reading import history:', error);
      return [];
    }
  }

  // 写入导入历史
  writeImportHistory(historyItem) {
    try {
      const history = this.readImportHistory();
      // 限制历史记录数量
      if (history.length >= 100) {
        history.shift();
      }
      history.push(historyItem);
      fs.writeFileSync(this.importHistoryFile, JSON.stringify(history, null, 2));
      return true;
    } catch (error) {
      console.error('Error writing import history:', error);
      return false;
    }
  }

  // 导入数据
  importData(newData, importType = 'append') {
    try {
      let existingData = this.readData();
      
      if (importType === 'replace') {
        // 替换现有数据
        existingData = newData;
      } else {
        // 追加数据
        existingData = [...existingData, ...newData];
      }
      
      // 去重（基于id字段）
      const uniqueData = this.removeDuplicates(existingData);
      
      // 写入数据
      const success = this.writeData(uniqueData);
      
      // 记录导入历史
      this.writeImportHistory({
        timestamp: new Date().toISOString(),
        importType,
        records: newData.length,
        totalRecords: uniqueData.length
      });
      
      return {
        success,
        totalRecords: uniqueData.length,
        newRecords: newData.length
      };
    } catch (error) {
      console.error('Error importing data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 去重
  removeDuplicates(data) {
    const seen = new Set();
    return data.filter(item => {
      const id = item.id || item.title + item.price + item.shop;
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  // 获取导入历史
  getImportHistory() {
    return this.readImportHistory();
  }

  // 清空数据
  clearData() {
    return this.writeData([]);
  }
}

module.exports = new DataStorage();