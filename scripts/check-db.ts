import Database from 'better-sqlite3';

try {
  const db = new Database('products.db');
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get();
  console.log(`Total products in SQLite: ${count.count}`);
  
  const first = db.prepare('SELECT * FROM products LIMIT 1').get();
  console.log('First product:', JSON.stringify(first, null, 2));
} catch (e) {
  console.error('Error reading DB:', e.message);
}
