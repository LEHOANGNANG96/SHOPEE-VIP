import Database from 'better-sqlite3';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

const GOOGLE_SHEET_ID = '2PACX-1vQVognj9p3CH2N1QJ1drJ8krqihahPPMY1c6O58GzDcaxCCzI7KonDHwhq6MtqvZ4fbq7HEYdYW8vfB';
const GOOGLE_SHEET_GID = '43749442';
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/e/${GOOGLE_SHEET_ID}/pub?gid=${GOOGLE_SHEET_GID}&single=true&output=csv`;

const db = new Database('products.db');

async function sync() {
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
        numericSoldCount, createdAt, searchName
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const removeVietnameseTones = (str: string) => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase();
    };

    db.transaction(() => {
      for (const row of records) {
        const r = row as any;
        const name = r.name || r.Name || '';
        const image = r.image || r.Image || '';
        const originalPrice = r.originalPrice || r.OriginalPrice || '';
        const discountPrice = r.discountPrice || r.DiscountPrice || '';
        const category = r.category || r.Category || 'Điện tử';
        const badge = r.badge || r.Badge || '';
        const affiliateUrl = r.affiliateUrl || r.AffiliateUrl || '';
        const discountPercent = r.discountPercent || r.DiscountPercent || '';
        const soldCount = r.soldCount || r.SoldCount || '';

        const numericPrice = parseInt(discountPrice.replace(/\D/g, '')) || 0;
        const numericSoldCount = parseInt(soldCount.replace(/\D/g, '')) || 0;
        const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const searchName = `${name.toLowerCase()} ${removeVietnameseTones(name)} ${category.toLowerCase()} ${removeVietnameseTones(category)}`.substring(0, 500);

        insert.run(
          name, image, originalPrice, discountPrice, numericPrice,
          category, badge, affiliateUrl, discountPercent, soldCount,
          numericSoldCount, createdAt, searchName
        );
      }
    })();

    console.log('Sync completed successfully.');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

sync();
