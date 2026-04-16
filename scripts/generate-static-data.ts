import Database from 'better-sqlite3';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import slugify from 'slugify';

// Load config from config.json
const configPath = path.join(process.cwd(), 'config.json');
let GOOGLE_SHEET_ID = '2PACX-1vSno9tAM8tlClNXI6wNqurTMurAgrb90xF5Q5AUag3HauAC0eAVpd67h1C1M1bGpHc7x8WShHpV9dc7';
let GOOGLE_SHEET_GID = '443074711';

if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.GOOGLE_SHEET_ID) GOOGLE_SHEET_ID = config.GOOGLE_SHEET_ID;
  if (config.GOOGLE_SHEET_GID) GOOGLE_SHEET_GID = config.GOOGLE_SHEET_GID;
}

const GOOGLE_SHEET_CSV_URL = GOOGLE_SHEET_ID.startsWith('2PACX-')
  ? `https://docs.google.com/spreadsheets/d/e/${GOOGLE_SHEET_ID}/pub?gid=${GOOGLE_SHEET_GID}&single=true&output=csv`
  : `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${GOOGLE_SHEET_GID}`;

const db = new Database('products.db');

function slugifyText(text: string) {
  return slugify(text, { lower: true, strict: true, locale: 'vi' });
}

function removeVietnameseTones(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

// Ensure table exists
db.exec('DROP TABLE IF EXISTS products');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    extId TEXT,
    externalId TEXT,
    name TEXT,
    fullName TEXT,
    image TEXT,
    originalPrice TEXT,
    discountPrice TEXT,
    numericPrice INTEGER,
    category TEXT,
    rawCategory TEXT,
    badge TEXT,
    affiliateUrl TEXT,
    discountPercent TEXT,
    soldCount TEXT,
    numericSoldCount INTEGER,
    ratingCount TEXT,
    likesCount TEXT,
    ratingScore TEXT,
    createdAt TEXT,
    searchName TEXT
  )
`);

async function run() {
  console.log('Fetching data from Google Sheets...');
  try {
    const response = await axios.get(GOOGLE_SHEET_CSV_URL);
    const csvData = response.data;
    console.log('CSV Data length:', csvData.length);

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true
    }) as any[];

    console.log('Parsed records:', records.length);

    if (records.length === 0) {
      console.log('No records found in CSV.');
      return;
    }

    // Clear existing products
    db.prepare('DELETE FROM products').run();

    const insert = db.prepare(`
      INSERT INTO products (
        name, image, originalPrice, discountPrice, numericPrice, 
        category, badge, affiliateUrl, discountPercent, soldCount, 
        numericSoldCount, ratingCount, likesCount, ratingScore,
        createdAt, searchName, externalId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const row of records) {
        const r = row as any;
        
        const getVal = (keys: string[]) => {
          const foundKey = Object.keys(r).find(k => 
            keys.some(target => k.trim().toLowerCase() === target.toLowerCase())
          );
          return foundKey ? String(r[foundKey]).trim() : null;
        };

        const rawName = getVal(['Tên sản phẩm', 'Name', 'tên', 'Sản phẩm', 'Tiêu đề', 'Product Name', 'Title', 'Tên']) || '';
        const words = String(rawName).split(/\s+/);
        const name = words.length > 10 ? words.slice(0, 10).join(' ') + '...' : rawName;
        
        const affiliateUrl = getVal(['LINK SẢN PHẨM', 'Link Sản Phẩm', 'AffiliateUrl', 'link', 'URL', 'Liên kết', 'Link', 'Shopee Link', 'Đường dẫn']) || 'https://shopee.vn';
        const rawCategory = getVal(['Chuyên mục', 'Category', 'loại', 'Danh mục', 'Nhóm', 'Phân loại', 'Group']) || 'Khác';
        const category = rawCategory.split('>')[0].trim(); // Take main category
        const discountPrice = getVal(['Giá', 'Giá ưu đãi', 'Giá KM', 'Giá mới', 'Giá bán', 'Sale Price', 'DiscountPrice']) || '';
        const originalPrice = getVal(['Giá cao nhất', 'Giá gốc', 'Giá cũ', 'Giá niêm yết', 'OriginalPrice', 'Old Price']) || '';
        const image = getVal(['Ảnh_1', 'Image', 'ảnh', 'Hình ảnh', 'Thumbnail', 'Ảnh', 'Link ảnh', 'Hình']) || 'https://picsum.photos/seed/product/400/400';
        const discountPercent = getVal(['% ĐÃ GIẢM', '% ưu đãi giảm', '% ưu đãi', 'Ưu đãi', 'Giảm giá', '% Giảm giá', 'Discount', '%đã giảm', '% đã giảm', 'DiscountPercent']) || '';
        const soldCount = getVal(['Đã bán trong 30 ngày', 'Bán trong 30 ngày', 'SoldCount', 'Đã bán', 'Sold', 'Sales', 'Bán']) || '';
        const ratingCount = getVal(['Đánh giá', 'Rating Count', 'Ratings']) || '';
        const likesCount = getVal(['Thích', 'Likes', 'Like Count']) || '';
        const ratingScore = getVal(['Điểm đánh giá', 'Rating Score', 'Rating']) || '';
        const badge = getVal(['Badge', 'Nhãn', 'Huy hiệu']) || '';

        if (!name && !image) continue;

        const numericPrice = parseInt(discountPrice.replace(/\D/g, '')) || 0;
        
        let numericSoldCount = 0;
        if (soldCount) {
          const soldStr = String(soldCount).toLowerCase().replace(/[^0-9k]/g, '');
          if (soldStr.includes('k')) {
            numericSoldCount = Math.round(parseFloat(soldStr.replace('k', '')) * 1000);
          } else {
            numericSoldCount = parseInt(soldStr) || 0;
          }
        }

        const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const searchName = `${rawName.toLowerCase()} ${removeVietnameseTones(rawName)} ${category.toLowerCase()} ${removeVietnameseTones(category)}`.substring(0, 500);

        const namePart = String(name).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
        const urlHash = Math.abs(affiliateUrl.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)).toString(36);
        const extId = `p_${namePart}_${urlHash}`;

        insert.run(
          name, image, originalPrice, discountPrice, numericPrice,
          category, badge, affiliateUrl, discountPercent, soldCount,
          numericSoldCount, ratingCount, likesCount, ratingScore,
          createdAt, searchName, extId
        );
      }
    })();

    console.log('Sync to SQLite completed.');

    const allProducts = db.prepare('SELECT * FROM products').all();
    console.log(`Total products to export: ${allProducts.length}`);

    const dataDir = path.join(process.cwd(), 'public', 'data');
    const productsDir = path.join(dataDir, 'products');
    
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(productsDir)) fs.rmSync(productsDir, { recursive: true, force: true });
    fs.mkdirSync(productsDir, { recursive: true });

    // 1. Save Meta
    const categories = Array.from(new Set(allProducts.map((p: any) => p.category))).filter(Boolean);
    const meta = {
      totalProducts: allProducts.length,
      lastUpdate: new Date().toISOString(),
      categories
    };
    fs.writeFileSync(path.join(dataDir, 'meta.json'), JSON.stringify(meta, null, 2));

    // 2. Save Categories
    const categoriesData = categories.map(name => {
      const firstProduct = allProducts.find((p: any) => p.category === name);
      return {
        id: slugifyText(name as string),
        name,
        image: (firstProduct as any)?.image || 'https://picsum.photos/seed/cat/400/400',
        count: allProducts.filter((p: any) => p.category === name).length
      };
    });
    fs.writeFileSync(path.join(dataDir, 'categories.json'), JSON.stringify(categoriesData, null, 2));

    // 3. Save Search Index (Comprehensive for client-side search/sort)
    const searchIndex = allProducts.map((p: any) => ({
      i: p.externalId,
      n: p.name,
      n_n: removeVietnameseTones(p.name || '').toLowerCase(),
      c: p.category,
      p: p.discountPrice,
      op: p.originalPrice,
      img: p.image,
      u: p.affiliateUrl,
      pct: p.discountPercent,
      s: p.soldCount,
      rc: p.ratingCount,
      lc: p.likesCount,
      rs: p.ratingScore,
      b: p.badge,
      np: p.numericPrice,
      ns: p.numericSoldCount
    }));
    fs.writeFileSync(path.join(dataDir, 'search-index.json'), JSON.stringify(searchIndex));

    // 4. Save Paginated Products
    const pageSize = 100;
    const savePages = (items: any[], subDir: string) => {
      const dir = path.join(productsDir, subDir);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const totalPages = Math.ceil(items.length / pageSize);
      for (let i = 1; i <= totalPages; i++) {
        const pageItems = items.slice((i - 1) * pageSize, i * pageSize);
        fs.writeFileSync(path.join(dir, `${i}.json`), JSON.stringify({
          products: pageItems,
          total: items.length,
          page: i,
          totalPages
        }));
      }
    };

    savePages(allProducts, 'all');

    const grouped = allProducts.reduce((acc: any, p: any) => {
      const cat = p.category || 'Khác';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [cat, items] of Object.entries(grouped)) {
      const catSlug = slugifyText(cat);
      savePages(items as any[], catSlug);
    }

    console.log('Static export completed.');

  } catch (error) {
    console.error('Operation failed:', error);
  }
}

run();
