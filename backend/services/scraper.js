const { chromium } = require('playwright');

class Scraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      this.page = await this.browser.newPage();
      
      // 设置随机User-Agent，避免被识别为爬虫
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      ];
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      await this.page.setUserAgent(randomUserAgent);
      
      // 设置视图大小
      await this.page.setViewport({ width: 1366, height: 768 });
      
      // 模拟真实用户行为
      await this.page.evaluate(() => {
        // 添加一些随机的本地存储数据
        localStorage.setItem('taobao_user', Math.random().toString(36).substr(2, 9));
        localStorage.setItem('taobao_session', Math.random().toString(36).substr(2, 9));
      });
    } catch (error) {
      console.error('Error initializing browser:', error);
      throw new Error(`浏览器初始化失败: ${error.message}`);
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }

  async scrapeTaobaoCeramics(keyword, pageCount = 1, concurrency = 3) {
    // 参数验证
    if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
      throw new Error('关键词不能为空');
    }
    
    if (keyword.length > 50) {
      throw new Error('关键词长度不能超过50个字符');
    }
    
    const pageCountNum = parseInt(pageCount);
    if (isNaN(pageCountNum) || pageCountNum <= 0) {
      throw new Error('页数必须是正整数');
    }
    
    if (pageCountNum > 100) {
      throw new Error('页数不能超过100页');
    }
    
    const concurrencyNum = parseInt(concurrency);
    if (isNaN(concurrencyNum) || concurrencyNum <= 0) {
      throw new Error('并发数必须是正整数');
    }
    
    if (concurrencyNum > 10) {
      throw new Error('并发数不能超过10');
    }

    const results = [];
    const pageNumbers = Array.from({ length: pageCountNum }, (_, i) => i + 1);
    
    // 并发处理函数
    const processPage = async (pageNum) => {
      const url = `https://s.taobao.com/search?q=${encodeURIComponent(keyword)}&s=${(pageNum - 1) * 44}`;
      
      let success = false;
      let retries = 3;
      
      while (!success && retries > 0) {
        try {
          // 随机延迟，模拟真实用户行为
          await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
          
          await this.page.goto(url, { 
            waitUntil: 'networkidle',
            timeout: 30000 // 30秒超时
          });
          
          // 随机滚动页面，模拟真实用户行为
          await this.page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
              window.scrollBy(0, Math.random() * 300 + 200);
              await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300));
            }
          });
          
          // 等待商品列表加载，增加超时设置
          await this.page.waitForSelector('.m-itemlist .items .item, .grid-item, .product-item, .item-card', { timeout: 15000 });
          
          // 提取商品信息
          const pageResults = await this.page.evaluate(() => {
            const items = [];
            // 使用更通用的选择器，提高兼容性
            const itemSelectors = [
              '.m-itemlist .items .item',
              '.grid-item',
              '.product-item',
              '.item-card'
            ];
            
            let itemsFound = false;
            for (const selector of itemSelectors) {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                elements.forEach(item => {
                  const title = item.querySelector('.title a, .product-title, .item-title')?.innerText?.trim() || '';
                  const price = item.querySelector('.price strong, .product-price, .item-price')?.innerText?.trim() || '';
                  const sales = item.querySelector('.deal-cnt, .product-sales, .item-sales')?.innerText?.trim() || '';
                  const shop = item.querySelector('.shop a, .shop-name, .item-shop')?.innerText?.trim() || '';
                  const location = item.querySelector('.location, .shop-location, .item-location')?.innerText?.trim() || '';
                  
                  // 确保数据结构统一
                  items.push({
                    title: title || '',
                    price: price || '',
                    sales: sales || '',
                    shop: shop || '',
                    location: location || ''
                  });
                });
                itemsFound = true;
                break;
              }
            }
            
            return items;
          });
          
          success = true;
          return pageResults;
        } catch (error) {
          console.error(`Error scraping page ${pageNum}:`, error.message);
          retries--;
          if (retries > 0) {
            console.log(`Retrying ${retries} more times...`);
            // 重试前等待一段时间，时间逐渐增加
            await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
          } else {
            return [];
          }
        }
      }
    };
    
    // 分批并发处理
    for (let i = 0; i < pageNumbers.length; i += concurrencyNum) {
      const batch = pageNumbers.slice(i, i + concurrencyNum);
      const batchResults = await Promise.all(batch.map(processPage));
      batchResults.forEach(pageResults => {
        results.push(...pageResults);
      });
      
      // 批次之间添加延迟，避免请求过于密集
      if (i + concurrencyNum < pageNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
      }
    }
    
    return results;
  }

  async scrapeCompetitorPrices(shopIds, concurrency = 3) {
    // 参数验证
    if (!Array.isArray(shopIds) || shopIds.length === 0) {
      throw new Error('店铺ID列表不能为空');
    }
    
    if (shopIds.length > 50) {
      throw new Error('店铺ID数量不能超过50个');
    }
    
    const concurrencyNum = parseInt(concurrency);
    if (isNaN(concurrencyNum) || concurrencyNum <= 0) {
      throw new Error('并发数必须是正整数');
    }
    
    if (concurrencyNum > 10) {
      throw new Error('并发数不能超过10');
    }

    const prices = [];
    
    // 并发处理函数
    const processShop = async (shopId) => {
      // 验证shopId
      if (!shopId || typeof shopId !== 'string' && typeof shopId !== 'number') {
        console.warn(`Invalid shopId: ${shopId}`);
        return [];
      }
      
      const url = `https://shop${shopId}.taobao.com`;
      
      let success = false;
      let retries = 3;
      
      while (!success && retries > 0) {
        try {
          // 随机延迟，模拟真实用户行为
          await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
          
          await this.page.goto(url, { 
            waitUntil: 'networkidle',
            timeout: 30000 // 30秒超时
          });
          
          // 随机滚动页面，模拟真实用户行为
          await this.page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
              window.scrollBy(0, Math.random() * 300 + 200);
              await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300));
            }
          });
          
          // 等待商品列表加载，增加超时设置
          await this.page.waitForSelector('.shop-inner .grid-item, .grid-item, .product-item, .item-card', { timeout: 15000 });
          
          const shopPrices = await this.page.evaluate((shopId) => {
            const items = [];
            // 使用更通用的选择器，提高兼容性
            const itemSelectors = [
              '.shop-inner .grid-item',
              '.grid-item',
              '.product-item',
              '.item-card'
            ];
            
            let itemsFound = false;
            for (const selector of itemSelectors) {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                elements.forEach(item => {
                  const title = item.querySelector('.title a, .product-title, .item-title')?.innerText?.trim() || '';
                  const price = item.querySelector('.price, .product-price, .item-price')?.innerText?.trim() || '';
                  
                  // 确保数据结构统一
                  items.push({
                    shopId,
                    title: title || '',
                    price: price || ''
                  });
                });
                itemsFound = true;
                break;
              }
            }
            
            return items;
          }, shopId);
          
          success = true;
          return shopPrices;
        } catch (error) {
          console.error(`Error scraping shop ${shopId}:`, error.message);
          retries--;
          if (retries > 0) {
            console.log(`Retrying ${retries} more times...`);
            // 重试前等待一段时间，时间逐渐增加
            await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
          } else {
            return [];
          }
        }
      }
    };
    
    // 分批并发处理
    for (let i = 0; i < shopIds.length; i += concurrencyNum) {
      const batch = shopIds.slice(i, i + concurrencyNum);
      const batchResults = await Promise.all(batch.map(processShop));
      batchResults.forEach(shopPrices => {
        prices.push(...shopPrices);
      });
      
      // 批次之间添加延迟，避免请求过于密集
      if (i + concurrencyNum < shopIds.length) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
      }
    }
    
    return prices;
  }
}

module.exports = Scraper;