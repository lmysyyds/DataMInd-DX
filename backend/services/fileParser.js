const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const chardet = require('chardet');
const iconv = require('iconv-lite');

class FileParser {
  // 解析Excel文件
  parseExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      return this.normalizeData(data);
    } catch (error) {
      throw new Error(`Excel解析失败: ${error.message}`);
    }
  }

  // 解析CSV文件
  parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      try {
        // 读取文件并检测编码
        const buffer = fs.readFileSync(filePath);
        const encoding = chardet.detect(buffer) || 'utf8';
        console.log(`Detected CSV encoding: ${encoding}`);
        
        // 转换为UTF-8
        const content = iconv.decode(buffer, encoding);
        
        // 解析CSV
        const results = [];
        const csv = require('csv-parser');
        const { Readable } = require('stream');
        
        const stream = Readable.from(content);
        stream
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => {
            resolve(this.normalizeData(results));
          })
          .on('error', (error) => {
            reject(new Error(`CSV解析失败: ${error.message}`));
          });
      } catch (error) {
        reject(new Error(`CSV解析失败: ${error.message}`));
      }
    });
  }

  // 解析TXT文件
  parseTXT(filePath, separator = '\t') {
    try {
      // 读取文件并检测编码
      const buffer = fs.readFileSync(filePath);
      const encoding = chardet.detect(buffer) || 'utf8';
      console.log(`Detected TXT encoding: ${encoding}`);
      
      // 转换为UTF-8
      const content = iconv.decode(buffer, encoding);
      
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length === 0) {
        throw new Error('TXT文件为空');
      }
      
      // 假设第一行为表头
      const headers = lines[0].split(separator).map(header => header.trim());
      const data = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(value => value.trim());
        const row = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        data.push(row);
      }
      
      return this.normalizeData(data);
    } catch (error) {
      throw new Error(`TXT解析失败: ${error.message}`);
    }
  }

  // 规范化数据格式
  normalizeData(data) {
    return data.map((item, index) => {
      const normalized = {
        id: index + 1,
        title: item.title || item.name || item['商品名称'] || '',
        price: this.parsePrice(item.price || item['价格'] || ''),
        sales: this.parseSales(item.sales || item['销量'] || ''),
        shop: item.shop || item['店铺'] || '',
        location: item.location || item['地区'] || ''
      };
      
      // 保留其他字段
      Object.keys(item).forEach(key => {
        if (!normalized[key]) {
          normalized[key] = item[key];
        }
      });
      
      return normalized;
    });
  }

  // 解析价格
  parsePrice(price) {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    
    const cleaned = price.toString().replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  }

  // 解析销量
  parseSales(sales) {
    if (typeof sales === 'number') return sales;
    if (!sales) return 0;
    
    const cleaned = sales.toString().replace(/[^0-9]/g, '');
    return parseInt(cleaned) || 0;
  }

  // 根据文件扩展名选择解析方法
  async parseFile(filePath, options = {}) {
    const ext = path.extname(filePath).toLowerCase();
    const { separator = '\t' } = options;
    
    switch (ext) {
      case '.xlsx':
      case '.xls':
        return this.parseExcel(filePath);
      case '.csv':
        return await this.parseCSV(filePath);
      case '.txt':
        return this.parseTXT(filePath, separator);
      default:
        throw new Error('不支持的文件格式');
    }
  }
}

module.exports = new FileParser();