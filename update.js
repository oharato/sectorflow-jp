const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// 33 Industries List in Japanese and English
const SECTOR_METADATA = [
  { id: '0050', nameJa: '水産・農林業', nameEn: 'Fishery, Agriculture & Forestry' },
  { id: '1050', nameJa: '鉱業', nameEn: 'Mining' },
  { id: '2050', nameJa: '建設業', nameEn: 'Construction' },
  { id: '3050', nameJa: '食料品', nameEn: 'Foods' },
  { id: '3100', nameJa: '繊維製品', nameEn: 'Textiles & Apparels' },
  { id: '3150', nameJa: 'パルプ・紙', nameEn: 'Pulp & Paper' },
  { id: '3200', nameJa: '化学', nameEn: 'Chemicals' },
  { id: '3250', nameJa: '医薬品', nameEn: 'Pharmaceutical' },
  { id: '3300', nameJa: '石油・石炭製品', nameEn: 'Oil & Coal Products' },
  { id: '3350', nameJa: 'ゴム製品', nameEn: 'Rubber Products' },
  { id: '3400', nameJa: 'ガラス・土石製品', nameEn: 'Glass & Ceramics Products' },
  { id: '3450', nameJa: '鉄鋼', nameEn: 'Iron & Steel' },
  { id: '3500', nameJa: '非鉄金属', nameEn: 'Nonferrous Metals' },
  { id: '3550', nameJa: '金属製品', nameEn: 'Metal Products' },
  { id: '3600', nameJa: '機械', nameEn: 'Machinery' },
  { id: '3650', nameJa: '電気機器', nameEn: 'Electric Appliances' },
  { id: '3700', nameJa: '輸送用機器', nameEn: 'Transportation Equipment' },
  { id: '3750', nameJa: '精密機器', nameEn: 'Precision Instruments' },
  { id: '3800', nameJa: 'その他製品', nameEn: 'Other Products' },
  { id: '4050', nameJa: '電気・ガス業', nameEn: 'Electric Power & Gas' },
  { id: '5050', nameJa: '陸運業', nameEn: 'Land Transportation' },
  { id: '5100', nameJa: '海運業', nameEn: 'Marine Transportation' },
  { id: '5150', nameJa: '空運業', nameEn: 'Air Transportation' },
  { id: '5200', nameJa: '倉庫・運輸関連業', nameEn: 'Warehousing & Harbor Transportation Services' },
  { id: '5250', nameJa: '情報・通信業', nameEn: 'Information & Communication' },
  { id: '6050', nameJa: '卸売業', nameEn: 'Wholesale Trade' },
  { id: '6100', nameJa: '小売業', nameEn: 'Retail Trade' },
  { id: '7050', nameJa: '銀行業', nameEn: 'Banks' },
  { id: '7100', nameJa: '証券、商品先物取引業', nameEn: 'Securities & Commodity Futures' },
  { id: '7150', nameJa: '保険業', nameEn: 'Insurance' },
  { id: '7200', nameJa: 'その他金融業', nameEn: 'Other Financing Business' },
  { id: '8050', nameJa: '不動産業', nameEn: 'Real Estate' },
  { id: '9050', nameJa: 'サービス業', nameEn: 'Services' }
];

async function fetchJPXIndices() {
  try {
    const url = 'https://www.jpx.co.jp/market/indices/indices_stock_price3.txt';
    console.log('Fetching sector indices from JPX...');
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    return data.IndustryType;
  } catch (error) {
    console.error('Error fetching JPX indices:', error.message);
    return null;
  }
}

async function scrapeStocksForSector(kabutanId, sectorName) {
  let page = 1;
  let hasNext = true;
  const stocks = [];
  
  console.log(`  Scraping stocks for "${sectorName}"...`);
  
  while (hasNext && page <= 10) {
    try {
      const url = `https://kabutan.jp/themes/?industry=${kabutanId}&stc=zenhiritsu&stm=1&page=${page}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      let stockTable = null;
      
      $('table').each((i, el) => {
        const headers = [];
        $(el).find('th').each((idx, thEl) => headers.push($(thEl).text().trim()));
        if (headers.includes('コード') && headers.includes('銘柄名')) {
          stockTable = el;
        }
      });
      
      if (!stockTable) break;
      
      let count = 0;
      $(stockTable).find('tbody tr').each((i, el) => {
        const cells = $(el).find('td');
        if (cells.length >= 8) {
          const code = $(cells[0]).text().trim();
          const name = $(cells[1]).text().trim();
          const market = $(cells[2]).text().trim();
          const price = $(cells[5]).text().trim();
          const change = $(cells[7]).text().trim();
          const changePercent = $(cells[8]).text().trim();
          
          if (code && name) {
            stocks.push({ code, name, market, price, change, changePercent });
            count++;
          }
        }
      });
      
      if (count === 0) break;
      
      // Check for next page
      const nextBtn = $('a:contains("次へ")');
      if (nextBtn.length > 0) {
        page++;
        // 1 second interval between pages to respect target server
        await new Promise(r => setTimeout(r, 1000));
      } else {
        hasNext = false;
      }
    } catch (err) {
      console.error(`  Error on page ${page} for ${sectorName}:`, err.message);
      break;
    }
  }
  
  console.log(`  -> Found ${stocks.length} stocks.`);
  return stocks;
}

async function main() {
  const startTime = Date.now();
  console.log('==================================================');
  console.log('SectorFlow JP: Starting Data Update Batch');
  console.log('==================================================');
  
  // 1. Fetch indices from JPX
  const jpxData = await fetchJPXIndices();
  if (!jpxData) {
    console.error('Fatal Error: Could not fetch JPX index data. Aborting update.');
    process.exit(1);
  }
  
  // 2. Loop through sectors and scrape stocks
  const sectorsResult = [];
  
  for (let i = 0; i < SECTOR_METADATA.length; i++) {
    const meta = SECTOR_METADATA[i];
    const kabutanId = i + 1;
    
    console.log(`\n[${i + 1}/${SECTOR_METADATA.length}] Processing Sector: ${meta.nameJa}`);
    
    // Find matching JPX data by index name
    let matchedJpx = null;
    for (const key of Object.keys(jpxData)) {
      if (jpxData[key].marketName === meta.nameJa) {
        matchedJpx = jpxData[key];
        break;
      }
    }
    
    let price = 0;
    let change = '0.00';
    let changePercent = 0;
    
    if (matchedJpx) {
      price = parseFloat(matchedJpx.currentPrice.replace(/,/g, '')) || 0;
      const changeVal = parseFloat(matchedJpx.previousDayComparison.replace(/,/g, '')) || 0;
      change = changeVal > 0 ? `+${changeVal.toFixed(2)}` : changeVal.toFixed(2);
      changePercent = parseFloat(matchedJpx.previousDayRatio.replace(/,/g, '')) || 0;
    } else {
      console.warn(`  Warning: Could not find JPX index values for "${meta.nameJa}"`);
    }
    
    // Scrape stocks list with 1-second delay
    const stocks = await scrapeStocksForSector(kabutanId, meta.nameJa);
    
    sectorsResult.push({
      id: meta.id,
      nameJa: meta.nameJa,
      nameEn: meta.nameEn,
      price: price,
      change: change,
      changePercent: changePercent,
      stocks: stocks
    });
    
    // 1 second interval between sectors
    if (i < SECTOR_METADATA.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  // 3. Save output data
  const outputData = {
    success: true,
    timestamp: Date.now(),
    sectors: sectorsResult
  };
  
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  
  // Save as JSON
  const jsonPath = path.join(publicDir, 'data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`\nSaved JSON data to: ${jsonPath}`);
  
  // Save as JS (for direct file:// browser support without CORS blocks)
  const jsPath = path.join(publicDir, 'data.js');
  fs.writeFileSync(jsPath, `window.sectorData = ${JSON.stringify(outputData, null, 2)};`, 'utf-8');
  console.log(`Saved JS data to: ${jsPath}`);
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n==================================================');
  console.log(`SectorFlow JP: Data update complete in ${elapsed} seconds!`);
  console.log('==================================================');
}

main();
