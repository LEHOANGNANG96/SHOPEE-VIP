import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import archiver from 'archiver';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import slugify from 'slugify';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { 
  initializeApp as initializeClientApp 
} from 'firebase/app';
import { 
  getFirestore as getClientFirestore, 
  collection as clientCollection, 
  doc as clientDoc,
  addDoc as clientAddDoc,
  getDocs as clientGetDocs, 
  getDoc as clientGetDoc,
  setDoc as clientSetDoc,
  updateDoc as clientUpdateDoc,
  deleteDoc as clientDeleteDoc,
  query as clientQuery, 
  limit as clientLimit,
  orderBy as clientOrderBy,
  startAfter as clientStartAfter,
  writeBatch as clientWriteBatch,
  serverTimestamp as clientServerTimestamp,
  getCountFromServer as clientGetCount,
  getDocsFromServer as clientGetDocsFromServer,
  getDocFromServer as clientGetDocFromServer,
  terminate as clientTerminate,
  setLogLevel as clientSetLogLevel,
  CollectionReference,
  DocumentReference,
  Query,
  WriteBatch
} from 'firebase/firestore';
import { getAuth as getClientAuth } from 'firebase/auth';
import admin from 'firebase-admin';
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Silencing Firestore logs by default to prevent quota noise
try { clientSetLogLevel('silent'); } catch(e) {}

function isQuotaError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('resource_exhausted') || msg.includes('quota');
}

// Lazy initialization for Firebase Admin and Firestore
const debugLog = (msg: string) => {
  const logMsg = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    const logPath = process.env.VERCEL ? path.join('/tmp', 'firebase_debug.log') : path.resolve('firebase_debug.log');
    fs.appendFileSync(logPath, logMsg);
  } catch (e) {
    console.error(`Failed to write to log: ${e.message}`);
  }
  console.log(msg);
};

let isQuotaExhausted = false;
let lastQuotaExhaustedTime = 0;
const QUOTA_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours cooldown for free tier reset
const QUOTA_STATUS_FILE = process.env.VERCEL ? path.join('/tmp', 'quota_status.json') : path.resolve('quota_status.json');

// NEW: Toggle to freeze Cloud Sync (Firestore)
// Set to false if you only want to update SQLite and save Firestore quota
const ENABLE_CLOUD_SYNC = false; 
const FORCE_LOCAL_ONLY = true; // New setting to completely bypass Firestore

function loadQuotaStatus() {
  try {
    if (fs.existsSync(QUOTA_STATUS_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUOTA_STATUS_FILE, 'utf8'));
      isQuotaExhausted = data.isQuotaExhausted;
      lastQuotaExhaustedTime = data.lastQuotaExhaustedTime;
      
      // Reset if expired
      if (isQuotaExhausted && Date.now() - lastQuotaExhaustedTime > QUOTA_COOLDOWN) {
        isQuotaExhausted = false;
        debugLog(`[QUOTA] Quota status expired, resetting.`);
        saveQuotaStatus();
      }
      
      debugLog(`[QUOTA] Loaded quota status: ${isQuotaExhausted} (last: ${new Date(lastQuotaExhaustedTime).toISOString()})`);
    }
  } catch (e: any) {
    debugLog(`[QUOTA] Failed to load quota status: ${e.message}`);
  }
}

function saveQuotaStatus() {
  try {
    fs.writeFileSync(QUOTA_STATUS_FILE, JSON.stringify({ isQuotaExhausted, lastQuotaExhaustedTime }));
  } catch (e: any) {
    debugLog(`[QUOTA] Failed to save quota status: ${e.message}`);
  }
}

// Load status immediately
loadQuotaStatus();

// --- Configuration Management ---
const CONFIG_FILE = path.resolve('config.json');
let appConfig: any = {
  GOOGLE_SHEET_ID: "2PACX-1vSno9tAM8tlClNXI6wNqurTMurAgrb90xF5Q5AUag3HauAC0eAVpd67h1C1M1bGpHc7x8WShHpV9dc7",
  GOOGLE_SHEET_GID: "443074711",
  VITE_FIREBASE_API_KEY: "AIzaSyBeAcmlOShFi8pBPVZiMHevyBfOwsPoWq0",
  VITE_FIREBASE_AUTH_DOMAIN: "gen-lang-client-0806655765.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "gen-lang-client-0806655765",
  VITE_FIREBASE_STORAGE_BUCKET: "gen-lang-client-0806655765.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "488804360994",
  VITE_FIREBASE_APP_ID: "1:488804360994:web:b994dee1143d17fb8dbb7b",
  VERCEL_DEPLOY_HOOK_URL: ""
};

function loadAppConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      appConfig = { ...appConfig, ...data };
      debugLog(`[CONFIG] Loaded app config from ${CONFIG_FILE}`);
      
      // Sync with existing variables
      if (appConfig.GOOGLE_SHEET_ID) GOOGLE_SHEET_ID = appConfig.GOOGLE_SHEET_ID;
      if (appConfig.GOOGLE_SHEET_GID) GOOGLE_SHEET_GID = appConfig.GOOGLE_SHEET_GID;
      if (appConfig.VERCEL_DEPLOY_HOOK_URL) VERCEL_DEPLOY_HOOK_URL = appConfig.VERCEL_DEPLOY_HOOK_URL;
      updateSheetUrl();
    }
  } catch (e: any) {
    debugLog(`[CONFIG] Failed to load app config: ${e.message}`);
  }
}

function updateSheetUrl() {
  if (GOOGLE_SHEET_ID && GOOGLE_SHEET_ID.startsWith('2PACX-')) {
    // Published link format (pubhtml)
    GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/e/${GOOGLE_SHEET_ID}/pub?gid=${GOOGLE_SHEET_GID}&single=true&output=csv`;
  } else if (GOOGLE_SHEET_ID) {
    // Standard link format (edit link)
    GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${GOOGLE_SHEET_GID}`;
  }
}

function saveAppConfig(newConfig: any) {
  try {
    appConfig = { ...appConfig, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(appConfig, null, 2));
    
    // Sync variables
    if (appConfig.GOOGLE_SHEET_ID) {
      GOOGLE_SHEET_ID = appConfig.GOOGLE_SHEET_ID;
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('GOOGLE_SHEET_ID', GOOGLE_SHEET_ID);
    }
    if (appConfig.GOOGLE_SHEET_GID) {
      GOOGLE_SHEET_GID = appConfig.GOOGLE_SHEET_GID;
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('GOOGLE_SHEET_GID', GOOGLE_SHEET_GID);
    }
    if (appConfig.VERCEL_DEPLOY_HOOK_URL) {
      VERCEL_DEPLOY_HOOK_URL = appConfig.VERCEL_DEPLOY_HOOK_URL;
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('VERCEL_DEPLOY_HOOK_URL', VERCEL_DEPLOY_HOOK_URL);
    }
    updateSheetUrl();
    
    // Async push to Firestore
    getFirestoreInstance().then(firestore => {
      if (firestore) {
        firestore.collection('app_config').doc('main').set(appConfig)
          .then(() => debugLog('[CONFIG] Pushed config to Firestore.'))
          .catch(err => debugLog(`[CONFIG] Failed to push to Firestore: ${err.message}`));
      }
    });

    debugLog(`[CONFIG] Saved app config to ${CONFIG_FILE} and SQLite settings table.`);
    return true;
  } catch (e: any) {
    debugLog(`[CONFIG] Failed to save app config: ${e.message}`);
    return false;
  }
}

async function syncConfigWithFirestore() {
  try {
    const firestore = await getFirestoreInstance();
    if (!firestore) return;

    debugLog('[CONFIG] Syncing config with Firestore...');
    const docRef = firestore.collection('app_config').doc('main');
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data();
      debugLog(`[CONFIG] Found config in Firestore: ${JSON.stringify(data)}`);
      
      // Update local config with Firestore data
      appConfig = { ...appConfig, ...data };
      
      // Persist to local file and SQLite for redundancy
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(appConfig, null, 2));
      
      if (appConfig.GOOGLE_SHEET_ID) {
        GOOGLE_SHEET_ID = appConfig.GOOGLE_SHEET_ID;
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('GOOGLE_SHEET_ID', GOOGLE_SHEET_ID);
      }
      if (appConfig.GOOGLE_SHEET_GID) {
        GOOGLE_SHEET_GID = appConfig.GOOGLE_SHEET_GID;
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('GOOGLE_SHEET_GID', GOOGLE_SHEET_GID);
      }
      if (appConfig.VERCEL_DEPLOY_HOOK_URL) {
        VERCEL_DEPLOY_HOOK_URL = appConfig.VERCEL_DEPLOY_HOOK_URL;
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('VERCEL_DEPLOY_HOOK_URL', VERCEL_DEPLOY_HOOK_URL);
      }
      updateSheetUrl();
      debugLog('[CONFIG] Local config updated from Firestore.');
    } else {
      debugLog('[CONFIG] No config found in Firestore. Uploading local config...');
      await docRef.set(appConfig);
    }
  } catch (e: any) {
    debugLog(`[CONFIG] Firestore sync failed: ${e.message}`);
  }
}

// --- End Configuration Management ---

// --- Smart Search Utilities ---
function removeVietnameseTones(str: string): string {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
  str = str.replace(/\u02C6|\u0306|\u031B/g, ""); 
  str = str.replace(/ + /g, " ");
  return str.trim().toLowerCase();
}

function slugifyText(text: string) {
  return slugify(text, { lower: true, strict: true });
}

async function saveStaticData(products: any[]) {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const productsDir = path.join(dataDir, 'products');
  
  debugLog(`[STATIC EXPORT] Starting export of ${products.length} products to ${dataDir}`);
  
  try {
    // Ensure directories exist
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(productsDir)) fs.rmSync(productsDir, { recursive: true, force: true });
    fs.mkdirSync(productsDir, { recursive: true });

    // 1. Save Meta
    const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
    const meta = {
      totalProducts: products.length,
      lastUpdate: new Date().toISOString(),
      categories
    };
    fs.writeFileSync(path.join(dataDir, 'meta.json'), JSON.stringify(meta, null, 2));

    // 2. Save Categories
    const categoriesData = categories.map(name => {
      const firstProduct = products.find(p => p.category === name);
      return {
        id: slugifyText(name),
        name,
        image: firstProduct?.image || 'https://picsum.photos/seed/cat/400/400',
        count: products.filter(p => p.category === name).length
      };
    });
    fs.writeFileSync(path.join(dataDir, 'categories.json'), JSON.stringify(categoriesData, null, 2));

    // 3. Save Search Index (Comprehensive for client-side search/sort)
    const searchIndex = products.map(p => ({
      i: p.externalId || p.extId,
      n: p.name,
      n_n: removeVietnameseTones(p.name || '').toLowerCase(),
      c: p.category,
      p: p.discountPrice,
      op: p.originalPrice,
      img: p.image,
      u: p.affiliateUrl,
      pct: p.discountPercent,
      s: p.soldCount,
      b: p.badge,
      np: p.numericPrice,
      ns: p.numericSoldCount
    }));
    fs.writeFileSync(path.join(dataDir, 'search-index.json'), JSON.stringify(searchIndex));

    // 4. Save Paginated Products
    const pageSize = 692;
    
    // Helper to save pages
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

    // Save "All"
    savePages(products, 'all');

    // Save by Category
    const grouped = products.reduce((acc, p) => {
      const cat = p.category || 'Khác';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [cat, items] of Object.entries(grouped)) {
      const catSlug = slugifyText(cat);
      savePages(items as any[], catSlug);
    }
    
    debugLog('[STATIC EXPORT] Export completed successfully.');
    return true;
  } catch (error) {
    console.error('[STATIC EXPORT] Error:', error);
    throw error;
  }
}

const SEARCH_SYNONYMS: Record<string, string[]> = {
  'giay': ['giay', 'sneaker', 'shoes', 'dep', 'sandal', 'guoc', 'boot', 'the thao', 'giay nu', 'giay nam'],
  'giay nu': ['giay nu', 'cao got', 'bup be', 'sandal nu', 'dep nu', 'guoc'],
  'giay nam': ['giay nam', 'sneaker nam', 'giay tay', 'giay luoi'],
  'ao': ['ao', 'quan ao', 'thoi trang', 'phong', 'so mi', 'khoac', 'len', 'hoodie', 'ao thun', 'ao kieu'],
  'ao nu': ['ao nu', 'vay', 'dam', 'chan vay', 'ao kieu', 'croptop', 'thoi trang nu'],
  'ao nam': ['ao nam', 'ao thun nam', 'ao so mi nam', 'thoi trang nam'],
  'quan': ['quan', 'quan ao', 'thoi trang', 'jean', 'kaki', 'short', 'dai', 'quan tay', 'quan thun'],
  'vay': ['vay', 'dam', 'chan vay', 'ao nu', 'thoi trang nu'],
  'dam': ['dam', 'vay', 'chan vay', 'ao nu', 'thoi trang nu'],
  'dien thoai': ['iphone', 'samsung', 'oppo', 'xiaomi', 'smartphone', 'mobile', 'phu kien', 'sac', 'cap', 'op lung'],
  'may tinh': ['laptop', 'pc', 'macbook', 'dell', 'hp', 'asus', 'linh kien', 'chuot', 'ban phim'],
  'tai nghe': ['headphone', 'earphone', 'airpods', 'bluetooth', 'am thanh', 'loa'],
  'son': ['my pham', 'trang diem', 'makeup', 'lipstick', 'sac dep', 'moi'],
  'kem': ['my pham', 'skincare', 'duong da', 'cream', 'serum', 'sac dep', 'mat'],
  'tui': ['tui xach', 'vi', 'balo', 'cap', 'tui deo cheo', 'tui nu', 'tui nam'],
  'dong ho': ['watch', 'smartwatch', 'dong ho deo tay', 'dong ho nam', 'dong ho nu'],
  'gia dung': ['bep', 'noi', 'quat', 'tu lanh', 'may giat', 'nha cua', 'dien gia dung'],
};

function getExpandedSearchTerms(query: string): string[] {
  const normalized = removeVietnameseTones(query);
  const words = normalized.split(/\s+/).filter(Boolean);
  const expanded = new Set<string>(words);
  
  // Expand individual words
  for (const word of words) {
    if (SEARCH_SYNONYMS[word]) {
      SEARCH_SYNONYMS[word].forEach(s => expanded.add(s));
    }
  }
  
  // Expand phrases (2-word combinations)
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i+1]}`;
    if (SEARCH_SYNONYMS[phrase]) {
      SEARCH_SYNONYMS[phrase].forEach(s => expanded.add(s));
    }
  }
  
  // Expand whole query if it's a known phrase
  if (SEARCH_SYNONYMS[normalized]) {
    SEARCH_SYNONYMS[normalized].forEach(s => expanded.add(s));
  }
  
  return Array.from(expanded);
}

// --- End Smart Search Utilities ---

const productCache = new Map<string, { data: any, timestamp: number }>();

debugLog('--- Server Starting ---');

// Safely load Firebase config
let firebaseConfig: any = {};
try {
  const configPath = path.resolve('firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    firebaseConfig = config;
    
    // Ensure we have a project ID from config or environment
    const envProjectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID;
    if (!config.projectId && envProjectId) {
      config.projectId = envProjectId;
    }
    
    debugLog(`[FIRESTORE] Using config: Project=${config.projectId}, DB=${config.firestoreDatabaseId}`);
  }
} catch (err) {
  console.error('Failed to load firebase-applet-config.json:', err);
}

// Admin Password (default)
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Chuate6789@';

// --- Firestore Client SDK Shim ---
// This shim allows the app to use the Client SDK with an API similar to the Admin SDK
// which is necessary when the Admin SDK lacks IAM permissions but the Client SDK (via API Key) works.

class CollectionShim {
  constructor(private db: any, private path: string) {}
  
  doc(id?: string) {
    const d = id ? clientDoc(this.db, this.path, id) : clientDoc(clientCollection(this.db, this.path));
    return new DocumentShim(this.db, d);
  }
  
  async add(data: any) {
    const docRef = await clientAddDoc(clientCollection(this.db, this.path), data);
    return new DocumentShim(this.db, docRef);
  }
  
  async get() {
    const snapshot = await clientGetDocs(clientCollection(this.db, this.path));
    return {
      docs: snapshot.docs.map(d => new DocumentSnapshotShim(d)),
      empty: snapshot.empty,
      size: snapshot.size
    };
  }
  
  limit(n: number) {
    return new QueryShim(clientQuery(clientCollection(this.db, this.path), clientLimit(n)));
  }
  
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    const q = clientCollection(this.db, this.path);
    return new QueryShim(clientQuery(q, clientOrderBy(field, direction)));
  }

  startAfter(doc: any) {
    const q = clientCollection(this.db, this.path);
    return new QueryShim(clientQuery(q, clientStartAfter(doc.snapshot || doc)));
  }
  
  count() {
    return {
      get: async () => {
        const snapshot = await clientGetCount(clientCollection(this.db, this.path));
        return {
          data: () => ({ count: snapshot.data().count })
        };
      }
    };
  }
}

class DocumentShim {
  constructor(private db: any, public ref: any) {}
  
  get id() { return this.ref.id; }
  
  async get() {
    const snapshot = await clientGetDoc(this.ref);
    return new DocumentSnapshotShim(snapshot);
  }
  
  async set(data: any, options?: any) {
    return await clientSetDoc(this.ref, data, options);
  }
  
  async update(data: any) {
    return await clientUpdateDoc(this.ref, data);
  }
  
  async delete() {
    return await clientDeleteDoc(this.ref);
  }
}

class DocumentSnapshotShim {
  constructor(private snapshot: any) {}
  get id() { return this.snapshot.id; }
  get exists() { return this.snapshot.exists(); }
  get ref() { return this.snapshot.ref; }
  data() { return this.snapshot.data(); }
}

class QueryShim {
  constructor(private q: any) {}
  
  limit(n: number) {
    return new QueryShim(clientQuery(this.q, clientLimit(n)));
  }
  
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new QueryShim(clientQuery(this.q, clientOrderBy(field, direction)));
  }
  
  startAfter(doc: any) {
    return new QueryShim(clientQuery(this.q, clientStartAfter(doc.snapshot || doc)));
  }

  async get() {
    const snapshot = await clientGetDocs(this.q);
    return {
      docs: snapshot.docs.map(d => new DocumentSnapshotShim(d)),
      empty: snapshot.empty,
      size: snapshot.size
    };
  }
}

class BatchShim {
  private batch: any;
  constructor(db: any) {
    this.batch = clientWriteBatch(db);
  }
  
  set(doc: any, data: any, options?: any) {
    const ref = doc.ref || doc;
    this.batch.set(ref, data, options);
    return this;
  }
  
  update(doc: any, data: any) {
    const ref = doc.ref || doc;
    this.batch.update(ref, data);
    return this;
  }
  
  delete(doc: any) {
    const ref = doc.ref || doc;
    this.batch.delete(ref);
    return this;
  }
  
  async commit() {
    return await this.batch.commit();
  }
}

class FirestoreShim {
  constructor(public db: any) {}
  
  collection(path: string) {
    return new CollectionShim(this.db, path);
  }
  
  doc(path: string) {
    const parts = path.split('/');
    if (parts.length % 2 !== 0) throw new Error("Invalid document path");
    const collPath = parts.slice(0, -1).join('/');
    const docId = parts[parts.length - 1];
    return new CollectionShim(this.db, collPath).doc(docId);
  }
  
  batch() {
    return new BatchShim(this.db);
  }
  
  settings(settings: any) {
    // Client SDK settings are different, ignore for now
  }
}

// --- End Shim ---

let _firestore: any = null;
let _initError: string | null = null;
let _initPromise: Promise<any | null> | null = null;

let _adminInitialized = false;
async function initFirebaseAdmin() {
  if (_adminInitialized) return;
  
  try {
    if (admin.apps.length === 0) {
      const configProjectId = firebaseConfig.projectId;
      const envProjectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID;
      // Prioritize environment project ID (actual project) over config (potentially stale from remix)
      const targetProjectId = envProjectId || configProjectId;
      
      const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (saEnv && saEnv.length > 20 && saEnv.startsWith('{')) {
        try {
          const sa = JSON.parse(saEnv);
          // If the service account project doesn't match the target project, it's likely from a remix
          if (sa.project_id && sa.project_id !== targetProjectId) {
            debugLog(`[FIRESTORE] Service account project (${sa.project_id}) mismatch with target (${targetProjectId}). Using default credentials.`);
            admin.initializeApp({ projectId: targetProjectId });
          } else {
            admin.initializeApp({
              credential: admin.credential.cert(sa),
              projectId: targetProjectId
            });
          }
        } catch (saErr: any) {
          admin.initializeApp({ projectId: targetProjectId });
        }
      } else {
        admin.initializeApp({ projectId: targetProjectId });
      }
    }
    _adminInitialized = true;
  } catch (e: any) {
    if (e.message.includes('already exists')) {
      _adminInitialized = true;
    } else {
      console.error('Firebase Admin init failed:', e);
    }
  }
}

async function getFirestoreInstance(force: boolean = false) {
  // Always ensure Admin is initialized for Auth, even if Firestore is skipped
  await initFirebaseAdmin();
  
  if (FORCE_LOCAL_ONLY && !force) {
    return null;
  }

  if (!force && isQuotaExhausted && Date.now() - lastQuotaExhaustedTime < QUOTA_COOLDOWN) {
    const remaining = Math.ceil((QUOTA_COOLDOWN - (Date.now() - lastQuotaExhaustedTime)) / (60 * 1000));
    debugLog(`[FIRESTORE] Skipping initialization due to quota exhaustion. (${remaining}m remaining)`);
    try { clientSetLogLevel('silent'); } catch(e) {}
    return null;
  }
  
  if (_initPromise && !force) return _initPromise;
  
  _initPromise = (async () => {
    console.log('--- Firebase Admin Initialization Start ---');
    try {
      const app = admin.app();
      const envProjectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID;
      const configProjectId = firebaseConfig.projectId;
      const actualProjectId = app.options.projectId || 'unknown';
      
      debugLog(`[FIRESTORE] Admin initialized. Config Project: ${configProjectId}, Env Project: ${envProjectId}, Actual: ${actualProjectId}`);
      
      const tryGetFirestore = async (databaseId?: string) => {
        const dbName = databaseId || '(default)';
        debugLog(`[FIRESTORE] Attempting connection to: ${dbName} in project ${actualProjectId}`);
        
        try {
          const fs = (databaseId && databaseId !== '(default)') ? getFirestore(app, databaseId) : getFirestore(app);
          debugLog(`[FIRESTORE] getFirestore returned instance.`);
          
          debugLog(`[FIRESTORE] Running health check read on ${dbName}...`);
          const healthCheck = async () => {
            try {
              // Try to read first
              await fs.collection('_health_check_').limit(1).get();
              debugLog(`[FIRESTORE] Health check read PASSED for ${dbName}`);
              return true;
            } catch (e: any) {
              const msg = e.message || String(e);
              debugLog(`[FIRESTORE] Health check read error for ${dbName}: ${msg}`);
              
              // If read fails with permission denied, try to write a dummy doc (Admin SDK should bypass rules)
              if (msg.includes('PERMISSION_DENIED')) {
                try {
                  debugLog(`[FIRESTORE] Attempting emergency write check for ${dbName}...`);
                  await fs.collection('_health_check_').doc('admin_test').set({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    test: true
                  });
                  debugLog(`[FIRESTORE] Emergency write check PASSED for ${dbName}. Admin SDK has write access.`);
                  return true;
                } catch (writeErr: any) {
                  debugLog(`[FIRESTORE] Emergency write check FAILED for ${dbName}: ${writeErr.message}`);
                }
              }

              if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('Quota limit exceeded')) {
                isQuotaExhausted = true;
                lastQuotaExhaustedTime = Date.now();
                saveQuotaStatus();
                debugLog('[QUOTA] Firestore quota limit reached. The application will automatically switch to Local Mode (SQLite) until the quota resets (usually daily).');
              }
              return false;
            }
          };

          const result = await Promise.race([
            healthCheck(),
            new Promise<boolean>((resolve) => setTimeout(() => {
              debugLog(`[FIRESTORE] Health check timed out after 30s for ${dbName}`);
              resolve(false);
            }, 30000))
          ]);

          if (!result) {
            throw new Error(`Health check failed or timed out for ${dbName}`);
          }

          fs.settings({ ignoreUndefinedProperties: true });
          debugLog(`[FIRESTORE] Connected and verified: ${dbName}`);
          return fs;
        } catch (adminErr: any) {
          debugLog(`[FIRESTORE] Admin health check failed for ${dbName}: ${adminErr.message}`);
          throw adminErr; // Let the caller handle fallback or retry
        }
      };

      const dbIdFromConfig = firebaseConfig?.firestoreDatabaseId;
      const isRemix = envProjectId && configProjectId && envProjectId !== configProjectId;
      
      if (isRemix) {
        debugLog(`[FIRESTORE] Remix detected! (Config: ${configProjectId}, Env: ${envProjectId}). Config DB ID (${dbIdFromConfig}) might be stale.`);
      }
      
      try {
        if (dbIdFromConfig && dbIdFromConfig !== '(default)') {
          debugLog(`[FIRESTORE] Attempting connection to named database: ${dbIdFromConfig}`);
          try {
            _firestore = await tryGetFirestore(dbIdFromConfig);
          } catch (namedErr: any) {
            debugLog(`[FIRESTORE] Named database attempt failed: ${namedErr.message}. Retrying with (default)...`);
            _firestore = await tryGetFirestore();
          }
        } else {
          debugLog(`[FIRESTORE] Attempting connection to (default) database`);
          _firestore = await tryGetFirestore();
        }
      } catch (e: any) {
        debugLog(`[FIRESTORE] Admin connection attempts failed: ${e.message}`);
        
        // Check if we detected quota exhaustion during Admin attempts
        if (isQuotaExhausted) {
          debugLog(`[FIRESTORE] Quota exhausted detected during Admin attempts. Skipping Client SDK fallback.`);
          _firestore = null;
          console.log('[FIRESTORE] Forcing fallback to SQLite mode due to quota exhaustion');
          return null;
        }

        // Final fallback to Client SDK Shim if Admin SDK failed completely
        debugLog(`[FIRESTORE] Attempting final fallback to Client SDK Shim...`);
        try {
          const clientApp = initializeClientApp(firebaseConfig);
          const clientDb = getClientFirestore(clientApp, dbIdFromConfig || '(default)');
          const clientAuth = getClientAuth(clientApp);
          
          // Client SDK fallback is for read-only or public access if Admin SDK fails
          // Anonymous sign-in is often restricted by admin, so we skip it to avoid noise
          debugLog('[FIRESTORE] Using Client SDK without authentication.');
          
          const clientHealthCheck = async () => {
            try {
              debugLog('[FIRESTORE] Verifying Client SDK connection...');
              const q = clientQuery(clientCollection(clientDb, '_health_check_'), clientLimit(1));
              try { clientSetLogLevel('silent'); } catch(e) {}
              
              // Use a network-level timeout for the fetch itself
              const fetchPromise = clientGetDocsFromServer(q);
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Network timeout')), 12000)
              );
              
              await Promise.race([fetchPromise, timeoutPromise]);
              debugLog('[FIRESTORE] Client SDK connection verified.');
              return { success: true };
            } catch (err: any) {
              const msg = err.message || String(err);
              let isQuota = false;
              if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('Quota limit exceeded')) {
                isQuota = true;
                isQuotaExhausted = true;
                lastQuotaExhaustedTime = Date.now();
                saveQuotaStatus();
                debugLog('[QUOTA] Firestore quota limit reached (Client SDK). Switching to Local Mode.');
                try { clientTerminate(clientDb); } catch(e) {}
              } else {
                debugLog(`[FIRESTORE] Client SDK connection check failed: ${msg}`);
              }
              return { success: false, error: msg, isQuota };
            }
          };

          const checkResult = await clientHealthCheck();

          if (checkResult.success) {
            debugLog(`[FIRESTORE] Client SDK Shim fallback PASSED!`);
            _firestore = new FirestoreShim(clientDb);
          } else {
            const reason = checkResult.isQuota ? "Quota exceeded" : (checkResult.error || "Unknown error");
            throw new Error(`Client SDK health check failed: ${reason}`);
          }
        } catch (clientErr: any) {
          debugLog(`[FIRESTORE] Client SDK Shim fallback failed: ${clientErr.message}`);
          _firestore = null;
          console.log('[FIRESTORE] Forcing fallback to SQLite mode due to connection failure');
        }
      }
    } catch (e: any) {
      console.error('[FIRESTORE] All connection attempts failed:', e.message);
      _firestore = null;
      _initPromise = null;
      
      console.log('[FIRESTORE] Forcing fallback to SQLite mode due to connection failure');
      
      let detailedError = e.message;
      if (e.message.includes('PERMISSION_DENIED')) {
        detailedError = "Lỗi quyền truy cập (Permission Denied). Vui lòng nhấn 'Accept' trong bảng Firebase Setup và đợi 1-2 phút. Nếu đây là bản Remix, bạn CẦN chạy lại 'set_up_firebase'.";
      } else if (e.message.includes('NOT_FOUND')) {
        detailedError = "Không tìm thấy Database. Vui lòng kiểm tra lại cấu hình Firebase hoặc chạy lại 'set_up_firebase'.";
      } else if (e.message.includes('timeout')) {
        detailedError = "Kết nối đến Firestore bị quá hạn (Timeout). Vui lòng kiểm tra kết nối mạng.";
      } else if (isQuotaExhausted) {
        detailedError = "Hạn mức Firestore (Quota) đã hết. Ứng dụng đã chuyển sang chế độ SQLite (Local Mode). Hạn mức sẽ tự động đặt lại sau 12-24h.";
      }
      
      _initError = `Firestore Error: ${detailedError} (Original: ${e.message})`;
    }
    console.log('--- Firebase Admin Initialization End ---');
    return _firestore;
  })();

  return _initPromise;
}

// Early initialization of Firestore
getFirestoreInstance().catch(err => {
  debugLog(`[FIRESTORE] Early initialization failed: ${err.message}`);
});

// Google Sheets Sync Constants
// Updated to ensure gid is handled correctly and output is forced to csv
let GOOGLE_SHEET_ID = '2PACX-1vSno9tAM8tlClNXI6wNqurTMurAgrb90xF5Q5AUag3HauAC0eAVpd67h1C1M1bGpHc7x8WShHpV9dc7';
let GOOGLE_SHEET_GID = '443074711';
let VERCEL_DEPLOY_HOOK_URL = '';
// Standard format for published CSV with specific GID
let GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/e/${GOOGLE_SHEET_ID}/pub?gid=${GOOGLE_SHEET_GID}&single=true&output=csv`;

// Load app config after variables are defined
loadAppConfig();
syncConfigWithFirestore();

debugLog('Initializing SQLite database...');
const dbPath = process.env.VERCEL 
  ? (fs.existsSync(path.join(process.cwd(), 'products.db')) ? path.join(process.cwd(), 'products.db') : '/tmp/products.db')
  : 'products.db';
let db: any;
try {
  db = new Database(dbPath, { timeout: 5000 });
  db.pragma('journal_mode = WAL');
  debugLog('SQLite database initialized.');
} catch (e: any) {
  console.error('[SQLITE] Failed to initialize database. Running in limited mode.', e.message);
  db = {
    prepare: () => ({
      run: () => ({}),
      get: () => null,
      all: () => []
    }),
    exec: () => ({}),
    transaction: (cb: any) => cb,
    pragma: () => ({})
  };
}

// Initialize database
debugLog('Running database schema initialization...');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    externalId TEXT,
    name TEXT NOT NULL,
    fullName TEXT,
    searchName TEXT,
    image TEXT NOT NULL,
    originalPrice TEXT,
    discountPrice TEXT,
    numericPrice INTEGER,
    category TEXT,
    rawCategory TEXT,
    badge TEXT,
    affiliateUrl TEXT,
    videoUrl TEXT,
    discountPercent TEXT,
    soldCount TEXT,
    numericSoldCount INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    name TEXT PRIMARY KEY,
    data TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_external_id ON products(externalId);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_numericPrice ON products(numericPrice);
  CREATE INDEX IF NOT EXISTS idx_products_numericSoldCount ON products(numericSoldCount);
  CREATE INDEX IF NOT EXISTS idx_products_searchName ON products(searchName);
`);

// Ensure new columns exist for existing databases
try {
  db.exec("ALTER TABLE products ADD COLUMN fullName TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE products ADD COLUMN rawCategory TEXT;");
} catch (e) {}

// Migration: Add numeric and search columns if they don't exist and populate them
async function runSQLiteMigrations() {
  debugLog('[DB] Starting background migrations...');
  try {
    const tableInfo = db.prepare("PRAGMA table_info(products)").all() as any[];
    const hasNumericPrice = tableInfo.some(col => col.name === 'numericPrice');
    const hasSearchName = tableInfo.some(col => col.name === 'searchName');
    
    if (!hasNumericPrice) {
      db.exec(`ALTER TABLE products ADD COLUMN numericPrice INTEGER;`);
      db.exec(`ALTER TABLE products ADD COLUMN numericSoldCount INTEGER;`);
      debugLog('[DB] Migration: Added numeric columns to products table');
    }
    
    if (!hasSearchName) {
      db.exec(`ALTER TABLE products ADD COLUMN searchName TEXT;`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_products_searchName ON products(searchName);`);
      debugLog('[DB] Migration: Added searchName column to products table');
    }

    // Populate columns for existing data if they are NULL
    const nullCount = db.prepare("SELECT COUNT(*) as count FROM products WHERE numericPrice IS NULL OR numericSoldCount IS NULL OR searchName IS NULL").get() as any;
    if (nullCount && nullCount.count > 0) {
      debugLog(`[DB] Migration: Populating columns for ${nullCount.count} products in chunks...`);
      
      const updateStmt = db.prepare("UPDATE products SET numericPrice = ?, numericSoldCount = ?, searchName = ? WHERE id = ?");
      let processed = 0;
      const chunkSize = 500;
      
      while (true) {
        const chunk = db.prepare("SELECT id, name, discountPrice, soldCount, rawCategory, category FROM products WHERE numericPrice IS NULL OR numericSoldCount IS NULL OR searchName IS NULL LIMIT ?").all(chunkSize) as any[];
        if (chunk.length === 0) break;
        
        const updateMany = db.transaction((items) => {
          for (const p of items) {
            const nPrice = parseInt(String(p.discountPrice || '0').replace(/\D/g, '')) || 0;
            let nSold = 0;
            if (p.soldCount) {
              const soldStr = String(p.soldCount).toLowerCase().replace(/[^0-9k]/g, '');
              if (soldStr.includes('k')) {
                nSold = Math.round(parseFloat(soldStr.replace('k', '')) * 1000);
              } else {
                nSold = parseInt(soldStr) || 0;
              }
            }
            const sName = `${String(p.name || '').toLowerCase()} ${removeVietnameseTones(String(p.name || ''))} ${String(p.rawCategory || '').toLowerCase()} ${removeVietnameseTones(String(p.rawCategory || ''))} ${String(p.category || '').toLowerCase()}`;
            updateStmt.run(nPrice, nSold, sName, p.id);
          }
        });
        
        updateMany(chunk);
        processed += chunk.length;
        if (processed % 5000 === 0 || processed >= nullCount.count) {
          debugLog(`[DB] Migration: Processed ${processed}/${nullCount.count} products...`);
        }
        // Yield to event loop
        await new Promise(resolve => setImmediate(resolve));
      }
      debugLog('[DB] Migration: Columns populated.');
    }

    // Migration: Update searchName to version 2 (with tone-less variations)
    const searchVersion = db.prepare('SELECT value FROM settings WHERE key = ?').get('search_version') as any;
    if (!searchVersion || searchVersion.value !== '2') {
      debugLog('[DB] Migration: Updating searchName to version 2 (with tone-less variations)...');
      
      // Use a generator or chunked approach to avoid loading everything into memory
      let offset = 0;
      const chunkSize = 1000;
      const updateSearchStmt = db.prepare("UPDATE products SET searchName = ? WHERE id = ?");
      
      while (true) {
        const chunk = db.prepare("SELECT id, name, rawCategory, category FROM products LIMIT ? OFFSET ?").all(chunkSize, offset) as any[];
        if (chunk.length === 0) break;
        
        const updateBatch = db.transaction((items) => {
          for (const p of items) {
            const sName = `${String(p.name || '').toLowerCase()} ${removeVietnameseTones(String(p.name || ''))} ${String(p.rawCategory || '').toLowerCase()} ${removeVietnameseTones(String(p.rawCategory || ''))} ${String(p.category || '').toLowerCase()}`;
            updateSearchStmt.run(sName, p.id);
          }
        });
        
        updateBatch(chunk);
        offset += chunk.length;
        if (offset % 5000 === 0) debugLog(`[DB] Migration: Updated ${offset} searchNames...`);
        
        // Yield to event loop
        await new Promise(resolve => setImmediate(resolve));
      }
      
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('search_version', '2');
      debugLog('[DB] Migration: searchName version 2 update complete.');
    }
    
    // Migration: Add new columns if they don't exist
    const columnsToAdd = ['videoUrl', 'discountPercent', 'soldCount'];
    for (const colName of columnsToAdd) {
      const exists = tableInfo.some((col: any) => col.name === colName);
      if (!exists) {
        try {
          db.prepare(`ALTER TABLE products ADD COLUMN ${colName} TEXT`).run();
          debugLog(`${colName} column added.`);
        } catch (e: any) {
          debugLog(`${colName} column migration failed: ${e.message}`);
        }
      }
    }
    
    debugLog('[DB] All background migrations completed.');
  } catch (e) {
    console.error('[DB] Migration failed:', e);
  }
}

// Load settings from database
try {
  const sheetIdSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('GOOGLE_SHEET_ID') as any;
  if (sheetIdSetting) GOOGLE_SHEET_ID = sheetIdSetting.value;
  
  const gidSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('GOOGLE_SHEET_GID') as any;
  if (gidSetting) GOOGLE_SHEET_GID = gidSetting.value;
  
  const deployHookSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('VERCEL_DEPLOY_HOOK_URL') as any;
  if (deployHookSetting) VERCEL_DEPLOY_HOOK_URL = deployHookSetting.value;
  
  const adminPass = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password') as any;
  if (adminPass) ADMIN_PASSWORD = adminPass.value;

  // Cập nhật mật khẩu theo yêu cầu của người dùng
  if (ADMIN_PASSWORD !== 'Chuate6789@') {
    ADMIN_PASSWORD = 'Chuate6789@';
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_password', ADMIN_PASSWORD);
    debugLog('[CONFIG] Admin password updated to Chuate6789@');
  }

  updateSheetUrl();
  debugLog(`[CONFIG] Loaded settings from DB: ID=${GOOGLE_SHEET_ID}, GID=${GOOGLE_SHEET_GID}`);
  
  // Start background migrations
  runSQLiteMigrations().catch(e => console.error('[DB] Background migration error:', e));
} catch (e: any) {
  debugLog(`[CONFIG] Failed to load settings from DB: ${e.message}`);
}
debugLog('Database schema initialized.');

// Migration: Add new columns if they don't exist
// This is now handled in runSQLiteMigrations()
/*
debugLog('Checking for column migrations...');
const tableInfo = db.prepare("PRAGMA table_info(products)").all();
const columnsToAdd = ['videoUrl', 'discountPercent', 'soldCount'];

for (const colName of columnsToAdd) {
  const exists = tableInfo.some((col: any) => col.name === colName);
  if (!exists) {
    try {
      db.prepare(`ALTER TABLE products ADD COLUMN ${colName} TEXT`).run();
      debugLog(`${colName} column added.`);
    } catch (e: any) {
      debugLog(`${colName} column migration failed: ${e.message}`);
    }
  } else {
    debugLog(`${colName} column already exists.`);
  }
}
*/

// Ensure upload directory exists
const uploadDir = path.resolve('public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for bulk images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original name for matching with Excel ID
    cb(null, file.originalname);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit
});

async function migrateToFirestore(force: boolean = false) {
  const firestore = await getFirestoreInstance();
  if (!firestore) {
    console.log('Firestore not initialized, skipping migration.');
    return;
  }
  console.log('Checking for data migration to Firestore...');
  try {
    // Check if Firestore already has data
    if (!force) {
      const snapshot = await firestore.collection('products').limit(1).get();
      if (!snapshot.empty) {
        console.log('Firestore already has data, skipping migration.');
        return;
      }
    }

    // Get total count first
    const countResult = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
    const totalProducts = countResult.count;
    
    if (totalProducts === 0) {
      console.log('No local products to migrate.');
      return;
    }

    console.log(`Migrating ${totalProducts} products to Firestore...`);
    
    const BATCH_SIZE = 500;
    let migratedCount = 0;
    
    // Process in batches using OFFSET to avoid loading all into memory
    for (let offset = 0; offset < totalProducts; offset += BATCH_SIZE) {
      const products = db.prepare('SELECT * FROM products LIMIT ? OFFSET ?').all(BATCH_SIZE, offset) as any[];
      const batch = firestore.batch();
      
      for (const p of products) {
        // Use externalId as doc ID if available to prevent duplicates
        const docRef = p.externalId 
          ? firestore.collection('products').doc(String(p.externalId))
          : firestore.collection('products').doc();
          
        batch.set(docRef, {
          externalId: p.externalId || '',
          name: p.name,
          image: p.image,
          originalPrice: p.originalPrice || '',
          discountPrice: p.discountPrice || '',
          numericPrice: p.numericPrice || 0,
          category: p.category || 'Khác',
          badge: p.badge || '',
          affiliateUrl: p.affiliateUrl || 'https://shopee.vn',
          videoUrl: p.videoUrl || '',
          discountPercent: p.discountPercent || '',
          soldCount: p.soldCount || '',
          numericSoldCount: p.numericSoldCount || 0,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          updatedAt: new Date(),
        }, { merge: true });
      }
      
      await batch.commit();
      migratedCount += products.length;
      console.log(`[MIGRATION] Progress: ${migratedCount}/${totalProducts} products synced.`);
      
      // Small delay to avoid hitting rate limits too hard
      if (offset + BATCH_SIZE < totalProducts) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

let lastSyncTime = 0;
let lastSyncCount = 0;
let lastSyncError = '';
let isSyncingInternal = false;

// Simple hash function for stable IDs
function generateHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normalizes and consolidates category names into a standard set of ~40 categories.
 */
function normalizeCategory(rawCategory: string): string {
  if (!rawCategory) return 'Khác';
  const cat = rawCategory.toLowerCase().trim();
  
  // Mapping logic - Order matters (more specific first)
  if (cat.includes('điện thoại') || cat.includes('phụ kiện điện thoại') || cat.includes('sạc') || cat.includes('tai nghe') || cat.includes('ốp lưng') || cat.includes('cáp')) return 'Điện Thoại & Phụ Kiện';
  if (cat.includes('máy tính') || cat.includes('laptop') || cat.includes('pc') || cat.includes('linh kiện') || cat.includes('màn hình') || cat.includes('chuột') || cat.includes('bàn phím')) return 'Máy Tính & Laptop';
  if (cat.includes('điện tử') || cat.includes('tivi') || cat.includes('loa') || cat.includes('âm thanh') || cat.includes('amply') || cat.includes('tai nghe chụp tai')) return 'Thiết Bị Điện Tử';
  if (cat.includes('máy ảnh') || cat.includes('quay phim') || cat.includes('camera') || cat.includes('ống kính') || cat.includes('phụ kiện máy ảnh')) return 'Máy Ảnh & Máy Quay Phim';
  if (cat.includes('đồng hồ')) return 'Đồng Hồ';
  if (cat.includes('giày') && (cat.includes('nam') || cat.includes('sneaker nam'))) return 'Giày Dép Nam';
  if (cat.includes('giày') && (cat.includes('nữ') || cat.includes('sneaker nữ') || cat.includes('cao gót'))) return 'Giày Dép Nữ';
  if (cat.includes('túi') || cat.includes('ví') || cat.includes('balo')) return 'Túi Ví Nữ';
  if (cat.includes('trang sức') || cat.includes('phụ kiện') || cat.includes('nhẫn') || cat.includes('vòng cổ') || cat.includes('khuyên tai')) return 'Phụ Kiện & Trang Sức Nữ';
  if (cat.includes('gia dụng') || cat.includes('bếp') || cat.includes('nồi') || cat.includes('quạt') || cat.includes('tủ lạnh') || cat.includes('máy giặt')) return 'Thiết Bị Điện Gia Dụng';
  if (cat.includes('nhà cửa') || cat.includes('đời sống') || cat.includes('nội thất') || cat.includes('trang trí') || cat.includes('chăn ga') || cat.includes('gối')) return 'Nhà Cửa & Đời Sống';
  if (cat.includes('sắc đẹp') || cat.includes('mỹ phẩm') || cat.includes('skincare') || cat.includes('trang điểm') || cat.includes('son') || cat.includes('serum')) return 'Sắc Đẹp';
  if (cat.includes('sức khỏe') || cat.includes('thực phẩm chức năng') || cat.includes('thuốc') || cat.includes('khẩu trang') || cat.includes('vitamin')) return 'Sức Khỏe';
  if (cat.includes('mẹ') || cat.includes('bé') || cat.includes('trẻ em') || cat.includes('tã') || cat.includes('bỉm') || cat.includes('sữa bột')) return 'Mẹ & Bé';
  if (cat.includes('đồ chơi')) return 'Đồ Chơi';
  if (cat.includes('thể thao') || cat.includes('du lịch') || cat.includes('dã ngoại') || cat.includes('gym') || cat.includes('yoga') || cat.includes('cắm trại')) return 'Thể Thao & Du Lịch';
  if (cat.includes('ô tô') || cat.includes('xe máy') || cat.includes('xe đạp') || cat.includes('phụ tùng') || cat.includes('mũ bảo hiểm')) return 'Ô Tô & Xe Máy & Xe Đạp';
  if (cat.includes('bách hóa') || cat.includes('thực phẩm') || cat.includes('đồ uống') || cat.includes('gia vị') || cat.includes('bánh kẹo')) return 'Bách Hóa Online';
  if (cat.includes('sách') || cat.includes('văn phòng phẩm') || cat.includes('bút') || cat.includes('vở') || cat.includes('truyện')) return 'Nhà Sách & Văn Phòng Phẩm';
  if (cat.includes('thú cưng') || cat.includes('chó') || cat.includes('mèo') || cat.includes('thức ăn thú cưng')) return 'Thú Cưng';
  if (cat.includes('nhạc cụ') || cat.includes('đàn') || cat.includes('guitar') || cat.includes('piano')) return 'Nhạc Cụ';
  if (cat.includes('voucher') || cat.includes('dịch vụ') || cat.includes('nạp thẻ') || cat.includes('vé')) return 'Voucher & Dịch Vụ';
  if (cat.includes('giặt giũ') || cat.includes('nước giặt') || cat.includes('xả vải') || cat.includes('vệ sinh nhà cửa')) return 'Giặt Giũ & Chăm Sóc Nhà Cửa';
  if (cat.includes('đồ lót') || cat.includes('đồ ngủ') || cat.includes('nội y')) return 'Đồ Lót & Đồ Ngủ';
  if (cat.includes('gaming') || cat.includes('console') || cat.includes('ps4') || cat.includes('ps5') || cat.includes('nintendo') || cat.includes('tay cầm')) return 'Gaming & Console';
  if (cat.includes('âm thanh') || cat.includes('loa') || cat.includes('amply') || cat.includes('dàn âm thanh')) return 'Âm Thanh';
  if (cat.includes('thiết bị mạng') || cat.includes('wifi') || cat.includes('router') || cat.includes('modem')) return 'Thiết Bị Mạng';
  if (cat.includes('linh kiện máy tính') || cat.includes('cpu') || cat.includes('vga') || cat.includes('ram') || cat.includes('mainboard')) return 'Linh Kiện Máy Tính';
  if (cat.includes('lưu trữ') || cat.includes('ổ cứng') || cat.includes('ssd') || cat.includes('usb') || cat.includes('thẻ nhớ')) return 'Thiết Bị Lưu Trữ';
  if (cat.includes('quà tặng') || cat.includes('lưu niệm')) return 'Quà Tặng';
  if (cat.includes('phụ kiện thời trang') || cat.includes('kính mắt') || cat.includes('khăn choàng') || cat.includes('găng tay')) return 'Phụ Kiện Thời Trang';
  if (cat.includes('thời trang trẻ em') || cat.includes('quần áo bé trai') || cat.includes('quần áo bé gái')) return 'Thời Trang Trẻ Em';
  if (cat.includes('thời trang nam') || cat.includes('áo nam') || cat.includes('quần nam')) return 'Thời Trang Nam';
  if (cat.includes('thời trang nữ') || cat.includes('áo nữ') || cat.includes('quần nữ') || cat.includes('váy') || cat.includes('đầm')) return 'Thời Trang Nữ';
  if (cat.includes('giày') || cat.includes('dép') || cat.includes('sneaker')) return 'Giày Dép';
  if (cat.includes('túi') || cat.includes('ví') || cat.includes('balo')) return 'Túi Ví';
  if (cat.includes('điện gia dụng') || cat.includes('đồ gia dụng')) return 'Đồ Gia Dụng';

  return 'Khác';
}

async function processData(data: any[]) {
  if (!data || data.length === 0) return 0;
  
  debugLog(`[DATA PROCESS] Processing ${data.length} rows. Updating databases...`);
  if (data.length > 0) {
    debugLog(`[DATA PROCESS] First row sample: ${JSON.stringify(data[0])}`);
  }
  
  const firestore = await getFirestoreInstance();

  // Helper for content hashing to avoid unnecessary Firestore writes
  const getContentHash = (item: any) => {
    const content = `${item.name}|${item.image}|${item.originalPrice}|${item.discountPrice}|${item.category}|${item.badge}|${item.affiliateUrl}|${item.videoUrl}|${item.soldCount}`;
    return generateHash(content);
  };

  // Read current SQLite state for diffing
  const existingProductsMap = new Map<string, string>();
  try {
    const rows = db.prepare('SELECT externalId, name, image, originalPrice, discountPrice, category, badge, affiliateUrl, videoUrl, soldCount FROM products').all();
    rows.forEach((row: any) => {
      const hash = getContentHash(row);
      existingProductsMap.set(row.externalId, hash);
    });
    debugLog(`[DATA PROCESS] Loaded ${existingProductsMap.size} existing products from SQLite for diffing.`);
  } catch (e) {
    debugLog(`[DATA PROCESS] Failed to load existing products for diffing: ${e}`);
  }

  const processedItems = data.map(item => {
    const getVal = (keys: string[]) => {
      const foundKey = Object.keys(item).find(k => 
        keys.some(target => k.trim().toLowerCase() === target.toLowerCase())
      );
      return foundKey ? String(item[foundKey]).trim() : null;
    };

    const rawName = getVal(['Tên sản phẩm', 'Name', 'tên', 'Sản phẩm', 'Tiêu đề', 'Product Name', 'Title', 'Tên']) || 'Sản phẩm không tên';
    const words = String(rawName).split(/\s+/);
    const name = words.length > 10 ? words.slice(0, 10).join(' ') + '...' : rawName;
    const affiliateUrl = getVal(['LINK SẢN PHẨM', 'Link Sản Phẩm', 'AffiliateUrl', 'link', 'URL', 'Liên kết', 'Link', 'Shopee Link', 'Đường dẫn']) || 'https://shopee.vn';
    const rawCategory = getVal(['Chuyên mục', 'Category', 'loại', 'Danh mục', 'Nhóm', 'Phân loại', 'Group']) || 'Khác';
    const category = normalizeCategory(rawCategory);
    const discountPrice = getVal(['Giá', 'Giá ưu đãi', 'Giá KM', 'Giá mới', 'Giá bán', 'Sale Price', 'DiscountPrice', 'Giá KM']) || '';
    const originalPrice = getVal(['Giá cao nhất', 'Giá gốc', 'Giá cũ', 'Giá niêm yết', 'giá cao nhất', 'OriginalPrice', 'Old Price']) || '';
    const image = getVal(['Ảnh_1', 'Image', 'ảnh', 'Hình ảnh', 'Thumbnail', 'Ảnh', 'Link ảnh', 'Hình']) || 'https://picsum.photos/seed/product/400/400';
    const videoUrl = getVal(['Video', 'video', 'Clip', 'Phim', 'Link video', 'Video URL']) || '';
    const discountPercent = getVal(['% ĐÃ GIẢM', '% ưu đãi giảm', '% ưu đãi', 'Ưu đãi', 'Giảm giá', '% Giảm giá', 'Discount', '%đã giảm', '% đã giảm', 'DiscountPercent', '% giảm', 'Giảm giá %', 'Discount %', 'Phần trăm giảm', 'Mức giảm']) || '';
    const soldCount = getVal(['Bán trong 30 ngày', 'SoldCount', 'Đã bán', 'Sold', 'Sales', 'Bán', 'Số lượng đã bán', 'Đã bán/tháng', 'Bán/tháng']) || '';
    
    const ratingVal = getVal(['Điểm đánh giá', 'Đánh giá', 'Rating', 'Sao', 'Điểm', 'Rating Value']);
    const likesVal = getVal(['Thích', 'Likes', 'Lượt thích', 'Yêu thích', 'Favorite']);
    const rating = ratingVal ? `⭐ ${ratingVal}` : '';
    const likes = likesVal ? `❤️ ${likesVal}` : '';
    const badge = [rating, likes].filter(Boolean).join(' | ') || '';

    const namePart = String(name).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
    const urlHash = generateHash(affiliateUrl);
    const extId = `p_${namePart}_${urlHash}`;

    // Calculate numeric values for sorting
    const numericPrice = parseInt(String(discountPrice || '0').replace(/\D/g, '')) || 0;
    
    let numericSoldCount = 0;
    if (soldCount) {
      const soldStr = String(soldCount).toLowerCase().replace(/[^0-9k]/g, '');
      if (soldStr.includes('k')) {
        numericSoldCount = Math.round(parseFloat(soldStr.replace('k', '')) * 1000);
      } else {
        numericSoldCount = parseInt(soldStr) || 0;
      }
    }

    const searchName = `${String(rawName || '').toLowerCase()} ${removeVietnameseTones(String(rawName || ''))} ${String(rawCategory || '').toLowerCase()} ${removeVietnameseTones(String(rawCategory || ''))} ${String(category || '').toLowerCase()}`;

    return {
      extId,
      name,
      fullName: rawName,
      searchName,
      image,
      originalPrice,
      discountPrice,
      numericPrice,
      category,
      rawCategory,
      badge,
      affiliateUrl,
      videoUrl,
      discountPercent,
      soldCount,
      numericSoldCount,
      rawItem: item
    };
  });

    try {
      const syncTransaction = db.transaction((items) => {
        // Clear existing products
        db.prepare('DELETE FROM products').run();
        
        // Prepare insert statement
        const insert = db.prepare(`
          INSERT INTO products (externalId, name, fullName, searchName, image, originalPrice, discountPrice, numericPrice, category, rawCategory, badge, affiliateUrl, videoUrl, discountPercent, soldCount, numericSoldCount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of items) {
          insert.run(
            item.extId,
            item.name,
            item.fullName,
            item.searchName,
            item.image,
            item.originalPrice,
            item.discountPrice,
            item.numericPrice,
            item.category,
            item.rawCategory,
            item.badge,
            item.affiliateUrl,
            item.videoUrl,
            item.discountPercent,
            item.soldCount,
            item.numericSoldCount
          );
        }
      });

      syncTransaction(processedItems);
      debugLog('[DATA PROCESS] SQLite updated successfully.');

      // 2. Update Static JSON Files (for frontend performance and export consistency)
      try {
        await saveStaticData(processedItems);
        debugLog('[DATA PROCESS] Static JSON files updated successfully.');
      } catch (staticErr) {
        console.error('[DATA PROCESS] Failed to update static JSON files:', staticErr);
      }

      // 3. Clear Cache
      if (typeof productCache !== 'undefined' && productCache.clear) {
        productCache.clear();
        debugLog('[DATA PROCESS] Product cache cleared.');
      }
    } catch (err) {
      debugLog(`[DATA PROCESS] SQLite update failed: ${err}`);
      throw err; // Re-throw to be caught by syncGoogleSheets
    }

    // 4. Update Firestore (Cloud)
  if (firestore) {
    try {
      // DIFFING: Only write to Firestore if the item is new or has changed
      // AND only if Cloud Sync is enabled
      if (!ENABLE_CLOUD_SYNC) {
        debugLog('[DATA PROCESS] Cloud Sync is DISABLED. Skipping Firestore update.');
        return processedItems.length;
      }

      let currentSaveBatch = firestore.batch();
      let saveCount = 0;
      let actualWrites = 0;
      let skippedCount = 0;

      for (const item of processedItems) {
        // DIFFING: Only write to Firestore if the item is new or has changed
        const newHash = getContentHash(item);
        const oldHash = existingProductsMap.get(item.extId);
        
        if (oldHash === newHash) {
          skippedCount++;
          continue;
        }

        const docRef = firestore.collection('products').doc(item.extId);
        
        const productData: any = {
          externalId: item.extId,
          name: item.name,
          fullName: item.fullName,
          searchName: item.searchName,
          image: item.image,
          originalPrice: item.originalPrice,
          discountPrice: item.discountPrice,
          numericPrice: item.numericPrice,
          category: item.category,
          rawCategory: item.rawCategory,
          badge: item.badge,
          affiliateUrl: item.affiliateUrl,
          videoUrl: item.videoUrl,
          discountPercent: item.discountPercent,
          soldCount: item.soldCount,
          numericSoldCount: item.numericSoldCount,
          updatedAt: new Date()
        };
        
        currentSaveBatch.set(docRef, productData, { merge: true });
        saveCount++;
        actualWrites++;

        if (saveCount >= 400) {
          await currentSaveBatch.commit();
          currentSaveBatch = firestore.batch();
          saveCount = 0;
          debugLog(`[DATA PROCESS] Committed batch of 400 writes...`);
        }
      }
      
      if (saveCount > 0) {
        await currentSaveBatch.commit();
        debugLog(`[DATA PROCESS] Committed final batch of ${saveCount} writes.`);
      }
      
      debugLog(`[DATA PROCESS] Sync completed. Writes: ${actualWrites}, Skipped: ${skippedCount}.`);
    } catch (err: any) {
      debugLog(`[DATA PROCESS] Firestore update failed: ${err}`);
    }
  }
  
  // 5. Save Static JSON Files (Split into small files for fast loading)
  try {
    await saveStaticData(processedItems);
    debugLog('[DATA PROCESS] Static JSON files generated successfully.');
  } catch (staticErr) {
    console.error('[DATA PROCESS] Failed to generate static JSON files:', staticErr);
  }
  
  return data.length;
}

async function syncGoogleSheets(isManual = false) {
  debugLog(`--- syncGoogleSheets(isManual=${isManual}) starting ---`);
  
  if (isQuotaExhausted) {
    if (isManual) {
      console.log('[QUOTA] Manual sync requested. Resetting quota flag to try again.');
      isQuotaExhausted = false;
      lastQuotaExhaustedTime = 0;
      saveQuotaStatus();
    } else {
      // Check if cooldown has passed
      if (Date.now() - lastQuotaExhaustedTime > QUOTA_COOLDOWN) {
        isQuotaExhausted = false;
        console.log('[QUOTA] Quota reset attempt after cooldown.');
      } else {
        debugLog('[QUOTA] Skipping sync due to quota exhaustion flag.');
        lastSyncError = 'Hạn mức Firestore (Quota) đã hết. Vui lòng thử lại sau 12-24h hoặc chuyển sang Local Mode.';
        return 0;
      }
    }
  }

  if (isSyncingInternal) {
    console.log('[SYNC] Already in progress, skipping...');
    // If it's been more than 5 minutes, something might be stuck, allow reset
    if (Date.now() - lastSyncTime > 5 * 60 * 1000) {
      console.log('[SYNC] Previous sync seems stuck, resetting...');
      isSyncingInternal = false;
    } else {
      return 0;
    }
  }
  
  isSyncingInternal = true;
  
  // Set a safety timeout to reset isSyncingInternal
  const safetyTimeout = setTimeout(() => {
    if (isSyncingInternal) {
      console.error('[SYNC] Safety timeout reached, resetting sync flag');
      isSyncingInternal = false;
    }
  }, 600000); // 10 minutes max sync time

  try {
    const cacheBuster = `&t=${Date.now()}`;
    const syncUrl = GOOGLE_SHEET_CSV_URL.includes('?') 
      ? `${GOOGLE_SHEET_CSV_URL}${cacheBuster}` 
      : `${GOOGLE_SHEET_CSV_URL}?${cacheBuster}`;
      
    console.log('[SYNC] Starting Google Sheets sync from:', syncUrl);
    
    const response = await axios.get(syncUrl, { 
      timeout: 60000,
      responseType: 'text',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log(`[SYNC] Response received. Length: ${response.data.length} bytes.`);
    console.log(`[SYNC] First 100 characters: ${response.data.substring(0, 100)}`);

    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      console.error('[SYNC] Error: Received HTML instead of CSV. Sheet might not be published.');
      throw new Error('Sheet chưa được "Xuất bản lên web" dưới dạng CSV. Vui lòng kiểm tra lại cấu hình trong Google Sheets.');
    }

    const csvData = response.data;
    
    if (!csvData || typeof csvData !== 'string') {
      throw new Error('Dữ liệu nhận được từ Google Sheets không hợp lệ (trống hoặc không phải chuỗi)');
    }

    const trimmedData = csvData.trim();
    if (trimmedData.startsWith('<!DOCTYPE html>') || trimmedData.startsWith('<html')) {
      console.error('[SYNC] Received HTML instead of CSV. Content preview:', trimmedData.substring(0, 200));
      throw new Error('Google Sheets trả về HTML thay vì CSV. Vui lòng kiểm tra xem Sheet đã được "Xuất bản lên web" (File > Share > Publish to web) với định dạng CSV cho đúng trang tính chưa.');
    }
    
    console.log(`[SYNC] Downloaded ${Math.round(csvData.length / 1024)} KB. Parsing CSV...`);
    
    const workbook = XLSX.read(csvData, { type: 'string', raw: true });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Không thể phân tích dữ liệu CSV');
    }
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

    const finalCount = await processData(data);
    
    debugLog(`[SYNC] Sync completed successfully. Processed ${finalCount} products.`);
    
    lastSyncTime = Date.now();
    lastSyncCount = finalCount;
    lastSyncError = '';
    
    clearTimeout(safetyTimeout);
    return finalCount;
  } catch (error: any) {
    if (!isQuotaError(error)) {
      console.error('[SYNC ERROR] Failed:', error.message);
    }
    lastSyncError = error.message;
    clearTimeout(safetyTimeout);
    throw error;
  } finally {
    isSyncingInternal = false;
  }
}

async function createApp() {
  debugLog('--- createApp() starting ---');
  const app = express();
  app.set('trust proxy', 1); // Trust first proxy (Cloud Run)

  // Run migration in background
  if (process.env.NODE_ENV !== 'production') {
    migrateToFirestore().catch(err => console.error('Background migration failed:', err));
  }

  // Seed sample product if it doesn't exist in SQLite (legacy support)
  try {
    const sampleExists = db.prepare('SELECT id FROM products WHERE image = ?').get('https://cf.shopee.vn/file/cn-11134207-7r98o-lz5rqtreriwj7d');
    if (!sampleExists) {
      console.log('Seeding sample product to SQLite...');
      db.prepare(`
        INSERT INTO products (name, image, originalPrice, discountPrice, category, badge, affiliateUrl)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'Sản phẩm mẫu Shopee (99k)',
        'https://cf.shopee.vn/file/cn-11134207-7r98o-lz5rqtreriwj7d',
        '150.000đ',
        '99.000đ',
        'Điện tử',
        'Deal hot',
        'https://shopee.vn'
      );
    }
  } catch (err) {
    console.error('Error during SQLite seeding:', err);
  }

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000, // Increased limit
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => {
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      }
      return req.ip;
    },
    handler: (req, res) => {
      res.status(429).json({ 
        error: 'Too Many Requests', 
        message: 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau 15 phút.' 
      });
    }
  });
  app.use('/api', limiter);

  app.use(express.json({ limit: '200mb' }));
  
  // --- Admin Authentication Middleware ---
  const authenticateAdmin = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      // Ensure Firebase Admin is initialized for Auth
      await initFirebaseAdmin();
      
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      // Check if email matches the admin email
      // We also allow the user email provided in the context
      const adminEmails = ['soyman7777@gmail.com'];
      
      if (!decodedToken.email || !adminEmails.includes(decodedToken.email)) {
        debugLog(`[AUTH] Unauthorized access attempt by: ${decodedToken.email}`);
        return res.status(403).json({ error: 'Forbidden: Not an admin' });
      }
      
      req.user = decodedToken;
      next();
    } catch (error: any) {
      debugLog(`[AUTH] Token verification failed: ${error.message}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };

  // Apply authentication to all admin routes
  app.use('/api/admin', authenticateAdmin);
  
  // --- Admin Config Routes ---
  app.get('/api/admin/config', (req, res) => {
    res.json(appConfig);
  });

  app.post('/api/admin/config', (req, res) => {
    const success = saveAppConfig(req.body);
    if (success) {
      res.json({ success: true, message: 'Đã cập nhật cấu hình thành công' });
    } else {
      res.status(500).json({ success: false, error: 'Không thể lưu cấu hình' });
    }
  });
  // --- End Admin Config Routes ---

  // Serve static files from public directory
  app.use(express.static('public'));
  
  // Serve uploaded images
  app.use('/uploads', express.static(uploadDir));

  // API Routes
  app.get('/api/categories', async (req, res) => {
    try {
      // Use SQL aggregation for maximum efficiency
      // This avoids loading all products into memory and grouping in JS
      let categories: any[] = [];
      try {
        categories = db.prepare(`
          SELECT 
            category as name, 
            MAX(image) as image, 
            COUNT(*) as count 
          FROM products 
          GROUP BY category 
          ORDER BY count DESC
        `).all() as any[];
      } catch (sqlErr) {
        debugLog(`SQLite categories fetch failed: ${sqlErr}`);
        // Fallback to a very limited Firestore read if SQLite fails
        const firestore = await getFirestoreInstance();
        if (firestore && !isQuotaExhausted) {
          try {
            // Only read 100 docs for categories fallback, not 1000
            const snapshot = await firestore.collection('products').limit(100).get();
            const products = snapshot.docs.map((doc: any) => doc.data());
            
            const categoryMap = new Map<string, { name: string, image: string, count: number }>();
            products.forEach(p => {
              const catName = p.category || 'Khác';
              if (!categoryMap.has(catName)) {
                categoryMap.set(catName, {
                  name: catName,
                  image: p.image || 'https://picsum.photos/seed/cat/400/400',
                  count: 0
                });
              }
              categoryMap.get(catName)!.count++;
            });
            categories = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);
          } catch (fsErr) {
            if (!isQuotaError(fsErr)) {
              console.error('Firestore categories fetch failed:', fsErr);
            }
          }
        }
      }

      res.json(categories);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Simple in-memory cache for products
  const CACHE_TTL = 30 * 1000; // 30 seconds

  // --- Search Synonyms Optimization ---
  // We expand the synonyms to be more inclusive as requested
  const BROAD_SYNONYMS: Record<string, string[]> = {
    'giay': ['giay', 'sneaker', 'shoes', 'dep', 'sandal', 'guoc', 'boot', 'the thao', 'giay nu', 'giay nam', 'suc', 'cao got', 'bup be', 'giay tay', 'giay luoi'],
    'ao': ['ao', 'quan ao', 'thoi trang', 'phong', 'so mi', 'khoac', 'len', 'hoodie', 'ao thun', 'ao kieu', 'croptop', 'tanktop', 'polo', 'vest', 'jacket'],
    'quan': ['quan', 'quan ao', 'thoi trang', 'jean', 'kaki', 'short', 'dai', 'quan tay', 'quan thun', 'jogger', 'legging', 'sip', 'lot'],
    'vay': ['vay', 'dam', 'chan vay', 'ao nu', 'thoi trang nu', 'vay cuoi', 'vay xoe', 'vay suong'],
    'dam': ['dam', 'vay', 'chan vay', 'ao nu', 'thoi trang nu', 'dam da hoi', 'dam maxi', 'dam suong'],
    'tui': ['tui xach', 'vi', 'balo', 'cap', 'tui deo cheo', 'tui nu', 'tui nam', 'túi', 'ví', 'ba lô'],
    'tai nghe': ['tai nghe', 'headphone', 'earphone', 'airpods', 'bluetooth', 'am thanh', 'loa', 'tai nghe bluetooth', 'tai nghe gaming', 'tai nghe khong day'],
    'dong ho': ['dong ho', 'watch', 'smartwatch', 'dong ho deo tay', 'dong ho nam', 'dong ho nu', 'dong ho thong minh', 'dong ho co', 'dong ho dien tu'],
    'my pham': ['son', 'kem', 'skincare', 'makeup', 'trang diem', 'duong da', 'serum', 'mat na', 'nuoc hoa', 'dau goi', 'sua tam'],
    'do gia dung': ['bep', 'noi', 'quat', 'tu lanh', 'may giat', 'nha cua', 'dien gia dung', 'lo vi song', 'noi com dien', 'am sieu toc'],
    'phu kien': ['dong ho', 'kinh', 'day chuyen', 'nhan', 'bong tai', 'vong tay', 'that lung', 'khan choang', 'mu', 'non'],
  };

  // Merge broad synonyms into SEARCH_SYNONYMS
  Object.entries(BROAD_SYNONYMS).forEach(([key, values]) => {
    if (!SEARCH_SYNONYMS[key]) {
      SEARCH_SYNONYMS[key] = values;
    } else {
      const existing = new Set(SEARCH_SYNONYMS[key]);
      values.forEach(v => existing.add(v));
      SEARCH_SYNONYMS[key] = Array.from(existing);
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const category = req.query.category as string;
      const search = req.query.search as string;
      const sort = req.query.sort as string || 'newest';
      const mode = req.query.mode as string;
      const seed = parseInt(req.query.seed as string) || 0;
      const skip = (page - 1) * limit;

      const cacheKey = `products_${category || 'all'}_${search || 'none'}_${page}_${limit}_${sort}_${mode || 'auto'}_${seed}`;
      const cached = productCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json(cached.data);
      }

      const firestore = await getFirestoreInstance();
      let products: any[] = [];
      let total = 0;
      let usingFirestore = false;
      
      // Optimization: Default to SQLite for reads to save Firestore quota.
      // Only use Firestore if specifically requested (e.g. for admin verification)
      // or if we want to test cloud connectivity.
      // OR if we are on Vercel and SQLite is likely empty
      const isVercel = !!process.env.VERCEL;
      const forceFirestore = req.query.useFirestore === 'true' || (isVercel && !FORCE_LOCAL_ONLY);
      const forceLocal = mode === 'local';
      
      // For large datasets (like 45,000 products), Firestore is extremely limited for search and numeric sorting.
      // We prefer SQLite for these operations if the data is synced, as it supports efficient LIKE and numeric casting.
      const isSearchOrSort = search || sort.startsWith('price_') || sort === 'popular' || sort === 'random';
      
      if (firestore && forceFirestore && !isSearchOrSort && !forceLocal && !isQuotaExhausted) {
        usingFirestore = true;
        try {
          debugLog('[API] Fetching from Firestore (Requested)...');
          let query: any = firestore.collection('products');
          
          if (category && category !== 'Tất cả') {
            query = query.where('category', '==', category);
          }
          
          // Use Firestore ordering and limiting
          try {
            let limitedQuery = query;
            
            if (sort === 'popular') {
              limitedQuery = limitedQuery.orderBy('numericSoldCount', 'desc');
            } else {
              limitedQuery = limitedQuery.orderBy('createdAt', 'desc');
            }
            
            limitedQuery = limitedQuery.limit(skip + limit);
            const snapshot = await limitedQuery.get();
            products = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            
            // Get total count
            const countSnapshot = await query.count().get();
            total = countSnapshot.data().count;

            if (total === 0 && !category && !search) {
              // If Firestore is empty and no filters, fallback to SQLite
              debugLog('Firestore is empty, falling back to SQLite');
              usingFirestore = false;
            }
          } catch (queryErr) {
            debugLog(`Firestore optimized query failed, falling back to SQLite: ${queryErr}`);
            usingFirestore = false;
          }
        } catch (fsErr) {
          if (!isQuotaError(fsErr)) {
            console.error('Firestore fetch failed, falling back to SQLite:', fsErr);
          }
          usingFirestore = false;
        }
      } 
      
      if (!usingFirestore) {
        const params: any[] = [];
        const whereClauses: string[] = [];
        let fromClause = 'products';
        let hasRelevance = false;

        if (search) {
          const normalizedSearch = removeVietnameseTones(search);
          const expandedTerms = getExpandedSearchTerms(search);
          
          if (expandedTerms.length > 0) {
            hasRelevance = true;
            
            // 1. Filter using index - must match at least one expanded term
            const filterParts = expandedTerms.map(() => `searchName LIKE ?`);
            whereClauses.push(`(${filterParts.join(' OR ')})`);
            expandedTerms.forEach(term => params.push(`%${term}%`));

            // 2. Calculate relevance score
            const relevanceParts: string[] = [];
            const relevanceParams: any[] = [];
            
            // Exact match in name (highest priority)
            relevanceParts.push(`CASE WHEN LOWER(name) = ? THEN 500 ELSE 0 END`);
            relevanceParams.push(search.toLowerCase());
            
            // Exact match in normalized name
            relevanceParts.push(`CASE WHEN searchName = ? THEN 450 ELSE 0 END`);
            relevanceParams.push(normalizedSearch);
            
            // Name starts with search term
            relevanceParts.push(`CASE WHEN LOWER(name) LIKE ? THEN 300 ELSE 0 END`);
            relevanceParams.push(`${search.toLowerCase()}%`);
            
            // Normalized name starts with search term
            relevanceParts.push(`CASE WHEN searchName LIKE ? THEN 250 ELSE 0 END`);
            relevanceParams.push(`${normalizedSearch}%`);
            
            // Exact match in category
            relevanceParts.push(`CASE WHEN LOWER(category) = ? THEN 200 ELSE 0 END`);
            relevanceParams.push(search.toLowerCase());
            
            // Full search term match in searchName
            relevanceParts.push(`CASE WHEN searchName LIKE ? THEN 150 ELSE 0 END`);
            relevanceParams.push(`%${normalizedSearch}%`);
            
            // Expanded terms matches (synonyms etc)
            expandedTerms.forEach((term, i) => {
              relevanceParts.push(`CASE WHEN searchName LIKE ? THEN ${100 - Math.min(i, 50)} ELSE 0 END`);
              relevanceParams.push(`%${term}%`);
            });
            
            const relevanceSql = `(${relevanceParts.join(' + ')})`;
            
            // Add relevance params to the main params list later
            // We need to handle the fact that relevanceSql uses params too
            // The easiest way is to inject the values directly if they are safe, 
            // but here we should use placeholders.
            
            // Re-constructing the query to handle relevance params
            fromClause = `(SELECT *, ${relevanceSql} as search_relevance FROM products) AS p`;
            // We need to prepend relevanceParams to params because they are used in the FROM clause
            params.unshift(...relevanceParams);
          }
        }

        if (category && category !== 'Tất cả') {
          whereClauses.push('category = ?');
          params.push(category);
        }

        let sql = `SELECT * FROM ${fromClause}`;
        let countSql = `SELECT COUNT(*) as count FROM ${fromClause}`;

        if (whereClauses.length > 0) {
          const whereStr = ' WHERE ' + whereClauses.join(' AND ');
          sql += whereStr;
          countSql += whereStr;
        }

        // Handle sorting in SQLite
        if (hasRelevance && sort === 'newest') {
          sql += ' ORDER BY p.search_relevance DESC, id DESC';
        } else if (sort === 'price_asc') {
          sql += ' ORDER BY numericPrice ASC, id DESC';
        } else if (sort === 'price_desc') {
          sql += ' ORDER BY numericPrice DESC, id DESC';
        } else if (sort === 'popular') {
          // Popular: Sort by sold count, then by a stable hash to keep it diverse if counts are equal
          sql += ' ORDER BY numericSoldCount DESC, (id * 17 % 1000003) DESC';
        } else if (sort === 'random' || (sort === 'newest' && !category)) {
          // Diverse/Random: Interleave categories to ensure variety
          // If no category is selected and sort is newest, we also use diverse to make the home page look better
          const randomSeed = seed || Math.floor(Date.now() / (1000 * 60 * 60));
          sql = `
            SELECT * FROM (
              SELECT *, 
              ROW_NUMBER() OVER (
                PARTITION BY category 
                ORDER BY (id * ${randomSeed} % 1000003)
              ) as rank
              FROM ${fromClause}
              ${whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : ''}
            ) 
            ORDER BY rank, (id * ${randomSeed} % 1000003)
          `;
        } else {
          // Default newest: use id DESC as a proxy for newest
          sql += ' ORDER BY id DESC';
        }
        
        sql += ' LIMIT ? OFFSET ?';
        const queryParams = [...params, limit, skip];
        
        products = db.prepare(sql).all(...queryParams);
        const countResult = db.prepare(countSql).get(...params) as any;
        total = countResult?.count || 0;
      }

      const responseData = {
        products,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        usingFirestore
      };

      productCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
      res.json(responseData);
    } catch (err) {
      console.error('Error fetching products:', err);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });


  app.get('/api/products/diverse', (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string) || Math.floor(Math.random() * 1000000);
      
      // Get all categories
      const categories = db.prepare('SELECT DISTINCT category FROM products').all() as { category: string }[];
      
      if (categories.length === 0) {
        return res.json([]);
      }

      // For each category, get 2 random products (using the seed for stability if needed, or just random)
      // To keep it fast, we'll do it in a single query with ROW_NUMBER if supported, or multiple queries
      
      let allDiverseProducts: any[] = [];
      
      // We'll pick 2 products from each of the first 25 categories to get ~50 diverse products
      const selectedCategories = categories.slice(0, 25);
      
      for (const cat of selectedCategories) {
        const products = db.prepare(`
          SELECT * FROM products 
          WHERE category = ? 
          ORDER BY (id * ${seed} % 1000003) 
          LIMIT 2
        `).all(cat.category);
        allDiverseProducts = [...allDiverseProducts, ...products];
      }

      // Shuffle the final list
      allDiverseProducts.sort(() => 0.5 - Math.random());

      res.json(allDiverseProducts);
    } catch (err) {
      console.error('Error fetching diverse products:', err);
      res.status(500).json({ error: 'Failed to fetch diverse products' });
    }
  });

  app.post('/api/admin/fix-firebase-config', async (req, res) => {
    try {
      const configPath = path.resolve('firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Instead of forcing (default), we just ensure the config is reloaded
        // and if it's missing the databaseId, we set it to (default) as a fallback
        if (!config.firestoreDatabaseId) {
          config.firestoreDatabaseId = '(default)';
        }
        
        // Always try to discover the real project ID if possible
        const envProjectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID;
        if (envProjectId && config.projectId !== envProjectId) {
          console.log(`[ADMIN] Updating project ID from environment: ${envProjectId}`);
          config.projectId = envProjectId;
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        firebaseConfig = config; // Update in-memory config
        
        // Reset initialization to force a fresh connection attempt
        _firestore = null;
        _initError = null;
        _initPromise = null;
        
        res.json({ 
          success: true, 
          message: `Đã làm mới cấu hình Firebase (Database: ${config.firestoreDatabaseId}). Vui lòng tải lại trang.`,
          databaseId: config.firestoreDatabaseId
        });
      } else {
        res.status(404).json({ error: 'Không tìm thấy file cấu hình.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/normalize-categories', authenticateAdmin, async (req, res) => {
    try {
      debugLog('[ADMIN] Starting category normalization...');
      const products = db.prepare('SELECT id, category FROM products').all() as any[];
      
      const updateStmt = db.prepare('UPDATE products SET category = ? WHERE id = ?');
      const updateMany = db.transaction((items) => {
        for (const item of items) {
          const normalized = normalizeCategory(item.category);
          if (normalized !== item.category) {
            updateStmt.run(normalized, item.id);
          }
        }
      });
      
      updateMany(products);
      
      // Also update Firestore if available
      const firestore = await getFirestoreInstance();
      if (firestore) {
        const snapshot = await firestore.collection('products').get();
        const BATCH_SIZE = 500;
        let batch = firestore.batch();
        let count = 0;
        
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const normalized = normalizeCategory(data.category);
          if (normalized !== data.category) {
            batch.update(doc.ref, { category: normalized });
            count++;
            
            if (count % BATCH_SIZE === 0) {
              await batch.commit();
              batch = firestore.batch();
            }
          }
        }
        if (count % BATCH_SIZE !== 0) {
          await batch.commit();
        }
        debugLog(`[ADMIN] Firestore categories normalized: ${count} documents.`);
      }
      
      productCache.clear();
      res.json({ success: true, message: 'Đã chuẩn hóa danh mục thành công.' });
    } catch (err: any) {
      console.error('Normalization failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/discover-project", async (req, res) => {
    try {
      const response = await fetch("http://metadata.google.internal/computeMetadata/v1/project/project-id", {
        headers: { "Metadata-Flavor": "Google" }
      });
      const projectId = await response.text();
      res.json({ metadataProjectId: projectId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/firebase-info', async (req, res) => {
    try {
      const config = {
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
        envProjectId: process.env.GOOGLE_CLOUD_PROJECT,
      };
      
      let status = 'Not initialized';
      let actualProject = 'unknown';
      let canRead = false;
      let error = null;

      try {
        const fs = await getFirestoreInstance();
        if (fs) {
          status = 'Initialized';
          actualProject = getApp().options.projectId || 'unknown';
          try {
            await fs.collection('_health_check_').limit(1).get();
            canRead = true;
          } catch (e: any) {
            error = e.message;
          }
        }
      } catch (e: any) {
        status = 'Failed';
        error = e.message;
      }

      res.json({ config, status, actualProject, canRead, error });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/db-status', async (req, res) => {
    try {
      const firestore = await getFirestoreInstance();
      const apps = getApps();
      
      // SQLite Status
      const sqliteCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
      const sqliteLastSync = lastSyncTime;
      const sqliteLastSyncCount = lastSyncCount;
      const sqliteError = lastSyncError;

      // Snapshots
      const snapshots = db.prepare('SELECT name, createdAt FROM snapshots ORDER BY createdAt DESC').all() as any[];

      // Cloud Status
      let cloudConnectivity = false;
      let cloudError = null;
      let cloudCount = 0;
      
      if (firestore) {
        try {
          // Use a very light query for connectivity check
          await firestore.collection('_health_check_').limit(1).get();
          cloudConnectivity = true;
          
          // Try to get actual product count from Firestore
          try {
            const countSnapshot = await firestore.collection('products').count().get();
            cloudCount = countSnapshot.data().count;
          } catch (countErr) {
            console.error('Failed to get cloud count:', countErr);
            // Fallback: just check if products collection exists/has data
            const sample = await firestore.collection('products').limit(1).get();
            if (!sample.empty) cloudCount = -1; // Indicates "some" data exists but count failed
          }
        } catch (e: any) {
          cloudError = e.message || String(e);
          // Check for quota error during status check
          if (isQuotaError(e)) {
            isQuotaExhausted = true;
            lastQuotaExhaustedTime = Date.now();
            saveQuotaStatus();
          }
        }
      }

      let actualProjectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'unknown';
      if (apps.length > 0) {
        actualProjectId = apps[0].options.projectId || actualProjectId;
      }

      res.json({
        cloud: {
          initialized: apps.length > 0,
          available: !!firestore,
          connectivity: cloudConnectivity,
          error: cloudError || _initError,
          projectId: firebaseConfig.projectId,
          databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
          isQuotaExhausted,
          lastQuotaExhaustedTime,
          remainingCooldown: isQuotaExhausted ? Math.max(0, QUOTA_COOLDOWN - (Date.now() - lastQuotaExhaustedTime)) : 0,
          actualProjectId: actualProjectId,
          productCount: cloudCount
        },
        local: {
          available: true,
          productCount: sqliteCount.count,
          lastSyncTime: sqliteLastSync,
          lastSyncCount: sqliteLastSyncCount,
          error: sqliteError,
          isCurrentMode: isQuotaExhausted || !firestore || !cloudConnectivity
        },
        activeMode: (!isQuotaExhausted && firestore && cloudConnectivity) ? 'cloud' : 'local',
        snapshots
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/admin/snapshots/save', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Snapshot name is required' });

    try {
      // 1. Get all settings
      const settings = db.prepare('SELECT key, value FROM settings').all() as any[];
      const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

      // 2. Get firebase config
      let firebaseConfigData = {};
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          firebaseConfigData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) {}

      // 3. Get metadata
      let metadataData = {};
      try {
        const metadataPath = path.join(process.cwd(), 'metadata.json');
        if (fs.existsSync(metadataPath)) {
          metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        }
      } catch (e) {}

      const snapshotData = {
        settings: settingsMap,
        firebaseConfig: firebaseConfigData,
        metadata: metadataData,
        timestamp: new Date().toISOString()
      };

      db.prepare('INSERT OR REPLACE INTO snapshots (name, data) VALUES (?, ?)').run(name, JSON.stringify(snapshotData));
      res.json({ success: true, message: `Đã lưu cấu hình thành công với tên: ${name}` });
    } catch (err: any) {
      console.error('Failed to save snapshot:', err);
      res.status(500).json({ error: 'Lỗi khi lưu snapshot: ' + err.message });
    }
  });

  app.post('/api/admin/snapshots/delete', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Snapshot name is required' });

    try {
      db.prepare('DELETE FROM snapshots WHERE name = ?').run(name);
      res.json({ success: true, message: `Đã xóa snapshot: ${name}` });
    } catch (err: any) {
      res.status(500).json({ error: 'Lỗi khi xóa snapshot: ' + err.message });
    }
  });

  app.get('/api/admin/backup/export', async (req, res) => {
    const includeProducts = req.query.includeProducts === 'true';

    try {
      // 1. Settings
      const settings = db.prepare('SELECT key, value FROM settings').all() as any[];
      const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

      // 2. Firebase Config
      let firebaseConfigData = {};
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          firebaseConfigData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) {}

      // 3. Metadata
      let metadataData = {};
      try {
        const metadataPath = path.join(process.cwd(), 'metadata.json');
        if (fs.existsSync(metadataPath)) {
          metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        }
      } catch (e) {}

      // 4. Products (Optional)
      let productsData = [];
      if (includeProducts) {
        productsData = db.prepare('SELECT * FROM products').all() as any[];
      }

      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        settings: settingsMap,
        firebaseConfig: firebaseConfigData,
        metadata: metadataData,
        products: productsData
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=backup_${new Date().getTime()}.json`);
      res.send(JSON.stringify(backup, null, 2));
    } catch (err: any) {
      res.status(500).json({ error: 'Lỗi khi xuất backup: ' + err.message });
    }
  });

  app.post('/api/admin/backup/import', express.json({ limit: '200mb' }), async (req, res) => {
    const backup = req.body;
    if (!backup || !backup.settings) return res.status(400).json({ error: 'Dữ liệu backup không hợp lệ' });

    try {
      // 1. Restore settings
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const [key, value] of Object.entries(backup.settings)) {
        stmt.run(key, value as string);
      }

      // 2. Restore Firebase Config
      if (backup.firebaseConfig) {
        fs.writeFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), JSON.stringify(backup.firebaseConfig, null, 2));
      }

      // 3. Restore Metadata
      if (backup.metadata) {
        fs.writeFileSync(path.join(process.cwd(), 'metadata.json'), JSON.stringify(backup.metadata, null, 2));
      }

      // 4. Restore Products (Optional)
      if (backup.products && backup.products.length > 0) {
        const deleteStmt = db.prepare('DELETE FROM products');
        deleteStmt.run();

        const insertProduct = db.prepare(`
          INSERT INTO products (
            id, name, image, originalPrice, discountPrice, discountPercent, 
            soldCount, rating, affiliateUrl, category, badge, description, 
            shopeeId, shopId, shopName, shopLocation, stock, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((products) => {
          for (const p of products) {
            insertProduct.run(
              p.id, p.name, p.image, p.originalPrice, p.discountPrice, p.discountPercent,
              p.soldCount, p.rating, p.affiliateUrl, p.category, p.badge, p.description,
              p.shopeeId, p.shopId, p.shopName, p.shopLocation, p.stock, p.updatedAt
            );
          }
        });
        transaction(backup.products);
      }

      res.json({ success: true, message: 'Đã nhập dữ liệu thành công. Vui lòng tải lại trang.' });
    } catch (err: any) {
      console.error('Import failed:', err);
      res.status(500).json({ error: 'Lỗi khi nhập backup: ' + err.message });
    }
  });

  app.post('/api/admin/snapshots/restore', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Snapshot name is required' });

    try {
      const snapshot = db.prepare('SELECT data FROM snapshots WHERE name = ?').get(name) as any;
      if (!snapshot) return res.status(404).json({ error: 'Không tìm thấy snapshot này' });

      const data = JSON.parse(snapshot.data);

      // 1. Restore settings
      if (data.settings) {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        for (const [key, value] of Object.entries(data.settings)) {
          stmt.run(key, value);
        }
      }

      // 2. Restore firebase config
      if (data.firebaseConfig) {
        fs.writeFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), JSON.stringify(data.firebaseConfig, null, 2));
      }

      // 3. Restore metadata
      if (data.metadata) {
        fs.writeFileSync(path.join(process.cwd(), 'metadata.json'), JSON.stringify(data.metadata, null, 2));
      }

      res.json({ success: true, message: `Đã khôi phục cấu hình thành công từ: ${name}. Vui lòng tải lại trang.` });
    } catch (err: any) {
      console.error('Failed to restore snapshot:', err);
      res.status(500).json({ error: 'Lỗi khi khôi phục snapshot: ' + err.message });
    }
  });

  app.get('/api/admin/firebase-status', async (req, res) => {
    try {
      const firestore = await getFirestoreInstance();
      const apps = getApps();
      
      let connectivity = false;
      let error = null;
      
      if (firestore) {
        try {
          // Try a simple query to check connectivity
          await firestore.collection('products').limit(1).get();
          connectivity = true;
        } catch (e) {
          error = String(e);
        }
      }

      res.json({
        initialized: apps.length > 0,
        firestoreAvailable: !!firestore,
        connectivity,
        error: error || _initError,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        mode: !isQuotaExhausted ? 'firestore' : 'sqlite',
        isQuotaExhausted,
        lastQuotaExhaustedTime,
        remainingCooldown: isQuotaExhausted ? Math.max(0, QUOTA_COOLDOWN - (Date.now() - lastQuotaExhaustedTime)) : 0,
        envProjectId: process.env.GOOGLE_CLOUD_PROJECT,
        hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/products', authenticateAdmin, async (req, res) => {
    try {
      const { name, image, originalPrice, discountPrice, category, badge, affiliateUrl, videoUrl, discountPercent, soldCount } = req.body;
      
      // Save to SQLite
      const stmt = db.prepare(`
        INSERT INTO products (name, image, originalPrice, discountPrice, category, badge, affiliateUrl, videoUrl, discountPercent, soldCount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const sqliteResult = stmt.run(
        name || 'Sản phẩm mới',
        image || '',
        originalPrice || '',
        discountPrice || '',
        category || 'Khác',
        badge || '',
        affiliateUrl || 'https://shopee.vn',
        videoUrl || '',
        discountPercent || '',
        soldCount || ''
      );

      // Save to Firestore if available
      let firestoreId = null;
      try {
        const firestore = await getFirestoreInstance();
        if (firestore) {
          const docRef = await firestore.collection('products').add({
            name: name || 'Sản phẩm mới',
            image: image || '',
            originalPrice: originalPrice || '',
            discountPrice: discountPrice || '',
            category: category || 'Khác',
            badge: badge || '',
            affiliateUrl: affiliateUrl || 'https://shopee.vn',
            videoUrl: videoUrl || '',
            discountPercent: discountPercent || '',
            soldCount: soldCount || '',
            createdAt: new Date(),
            sqliteId: sqliteResult.lastInsertRowid
          });
          firestoreId = docRef.id;
        }
      } catch (fsErr) {
        console.error('Firestore save failed:', fsErr);
      }
      
      res.json({ id: firestoreId || sqliteResult.lastInsertRowid, sqliteId: sqliteResult.lastInsertRowid });
    } catch (err: any) {
      console.error('Error adding product:', err);
      res.status(500).json({ error: 'Failed to add product' });
    }
  });

  // Bulk Image Upload
  app.post('/api/admin/upload-images', upload.array('images'), (req: any, res) => {
    res.json({ success: true, count: req.files?.length });
  });

  // Excel Upload and Process
  app.post('/api/admin/import-excel', upload.single('excel'), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const firestore = await getFirestoreInstance();
      if (!firestore) return res.status(500).json({ error: 'Firestore not initialized' });
      const workbook = XLSX.readFile(req.file.path);
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Excel file has no sheets');
      }
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data: any[] = XLSX.utils.sheet_to_json(worksheet);

      // OPTIMIZATION: Build a map of all files in the upload directory ONCE
      const files = fs.readdirSync(uploadDir);
      const fileMap = new Map<string, string>();
      files.forEach(f => {
        const fileNameWithoutExt = path.parse(f).name;
        fileMap.set(fileNameWithoutExt, f);
      });

      const transaction = async (items: any[]) => {
        const batch = firestore.batch();
        for (const item of items) {
          const extId = String(item.ID || item.id || '');
          // Try to find matching image in uploads
          let imagePath = item.Image || item.image || '';
          
          if (extId && (!imagePath || !imagePath.startsWith('http'))) {
            const match = fileMap.get(extId);
            if (match) {
              imagePath = `/uploads/${match}`;
            }
          }

          const docRef = firestore.collection('products').doc();
          batch.set(docRef, {
            externalId: extId,
            name: item.Name || item.name || 'Sản phẩm không tên',
            image: imagePath || 'https://picsum.photos/seed/product/400/400',
            originalPrice: String(item.OriginalPrice || item.original_price || ''),
            discountPrice: String(item.DiscountPrice || item.discount_price || ''),
            category: item.Category || item.category || 'Khác',
            badge: item.Badge || item.badge || '',
            affiliateUrl: item.AffiliateUrl || item.affiliate_url || 'https://shopee.vn',
            discountPercent: String(item.DiscountPercent || item.discount_percent || item['% ưu đãi giảm'] || ''),
            soldCount: String(item.SoldCount || item.sold_count || item['Bán trong 30 ngày'] || ''),
            createdAt: new Date(),
          });
        }
        await batch.commit();
      };

      await transaction(data);
      
      // Clean up the temp excel file
      fs.unlinkSync(req.file.path);
      
      res.json({ success: true, count: data.length });
    } catch (error) {
      console.error('Excel import error:', error);
      res.status(500).json({ error: 'Failed to process Excel file' });
    }
  });

  app.delete('/api/products/:id', authenticateAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      
      // Delete from SQLite (try both as ID and externalId if applicable)
      db.prepare('DELETE FROM products WHERE id = ? OR externalId = ?').run(id, id);
      
      // Delete from Firestore if available
      try {
        const firestore = await getFirestoreInstance();
        if (firestore) {
          await firestore.collection('products').doc(id).delete();
        }
      } catch (fsErr) {
        console.error('Firestore delete failed:', fsErr);
      }
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  app.post('/api/admin/clear-products', authenticateAdmin, async (req, res) => {
    try {
      // Clear SQLite
      db.prepare('DELETE FROM products').run();
      
      // Clear Firestore if available
      try {
        const firestore = await getFirestoreInstance();
        if (firestore) {
          let hasMore = true;
          while (hasMore) {
            const snapshot = await firestore.collection('products').limit(400).get();
            if (snapshot.empty) {
              hasMore = false;
            } else {
              const batch = firestore.batch();
              snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
              await batch.commit();
              if (snapshot.docs.length < 400) {
                hasMore = false;
              }
            }
          }
        }
      } catch (fsErr) {
        console.error('Firestore clear failed:', fsErr);
      }
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to clear products' });
    }
  });

  app.post('/api/admin/toggle-local-only', (req, res) => {
    res.json({ success: true, forceLocalOnly: true, message: "Firestore is permanently disabled." });
  });

  app.get('/api/admin/toggle-cloud-sync', (req, res) => {
    res.json({ success: true, enabled: false, message: "Cloud Sync is permanently disabled." });
  });

  app.post('/api/admin/reset-quota', (req, res) => {
    isQuotaExhausted = false;
    lastQuotaExhaustedTime = 0;
    saveQuotaStatus();
    // Clear Firestore cache to force re-initialization
    _firestore = null;
    _initPromise = null;
    _initError = null;
    try { clientSetLogLevel('error'); } catch(e) {}
    res.json({ success: true, message: 'Đã reset trạng thái hạn mức Firestore và chuyển về Cloud Mode.' });
  });

  app.get('/api/admin/sync-status', async (req, res) => {
    let totalInDb = 0;
    try {
      const firestore = await getFirestoreInstance();
      if (firestore) {
        try {
          const snapshot = await firestore.collection('products').count().get();
          totalInDb = snapshot.data()?.count || 0;
        } catch (fsErr) {
          if (!isQuotaError(fsErr)) {
            console.error('Firestore count failed, falling back to SQLite count:', fsErr);
          }
          const row = db.prepare('SELECT COUNT(*) as count FROM products').get() as any;
          totalInDb = row?.count || 0;
        }
      } else {
        const row = db.prepare('SELECT COUNT(*) as count FROM products').get() as any;
        totalInDb = row?.count || 0;
      }
    } catch (e) {
      console.error('Error in sync-status endpoint:', e);
    }

    res.json({
      lastSyncTime,
      lastSyncCount,
      lastSyncError: lastSyncError || _initError,
      isSyncing: isSyncingInternal,
      isQuotaExhausted,
      lastQuotaExhaustedTime,
      totalInDb,
      remainingCooldown: isQuotaExhausted ? Math.max(0, QUOTA_COOLDOWN - (Date.now() - lastQuotaExhaustedTime)) : 0,
      mode: FORCE_LOCAL_ONLY ? 'local-only' : (!isQuotaExhausted ? 'firestore' : 'sqlite'),
      forceLocalOnly: FORCE_LOCAL_ONLY,
      enableCloudSync: ENABLE_CLOUD_SYNC,
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      envProjectId: process.env.GOOGLE_CLOUD_PROJECT,
      sheetId: GOOGLE_SHEET_ID,
      gid: GOOGLE_SHEET_GID
    });
  });

  app.post('/api/admin/sync-status', (req, res) => {
    const { reset } = req.body;
    if (reset) {
      isSyncingInternal = false;
      console.log('[SYNC] Manual reset of sync flag');
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.post('/api/admin/migrate-to-cloud', async (req, res) => {
    try {
      // If user manually triggers migration, we should try to reset the quota flag
      isQuotaExhausted = false;
      lastQuotaExhaustedTime = 0;
      saveQuotaStatus();
      
      const firestore = await getFirestoreInstance(true);
      if (!firestore) return res.status(500).json({ error: 'Firestore not initialized' });
      
      // Get total count
      const countResult = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
      const totalProducts = countResult.count;
      
      if (totalProducts === 0) {
        return res.json({ success: true, message: 'Không có dữ liệu cục bộ để đẩy lên', count: 0 });
      }

      console.log(`[MIGRATION] Starting manual migration of ${totalProducts} products to Firestore...`);
      
      // Run migration in background to avoid request timeout
      (async () => {
        try {
          const BATCH_SIZE = 500;
          let migratedCount = 0;

          for (let offset = 0; offset < totalProducts; offset += BATCH_SIZE) {
            const products = db.prepare('SELECT * FROM products LIMIT ? OFFSET ?').all(BATCH_SIZE, offset) as any[];
            const batch = firestore.batch();
            
            for (const p of products) {
              const docRef = p.externalId 
                ? firestore.collection('products').doc(String(p.externalId))
                : firestore.collection('products').doc();
                
              batch.set(docRef, {
                externalId: p.externalId || '',
                name: p.name,
                image: p.image,
                originalPrice: p.originalPrice || '',
                discountPrice: p.discountPrice || '',
                numericPrice: p.numericPrice || 0,
                category: p.category || 'Khác',
                badge: p.badge || '',
                affiliateUrl: p.affiliateUrl || 'https://shopee.vn',
                videoUrl: p.videoUrl || '',
                discountPercent: p.discountPercent || '',
                soldCount: p.soldCount || '',
                numericSoldCount: p.numericSoldCount || 0,
                createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
                updatedAt: new Date(),
              }, { merge: true });
            }
            
            await batch.commit();
            migratedCount += products.length;
            console.log(`[MIGRATION] Manual Progress: ${migratedCount}/${totalProducts}`);
            
            if (offset + BATCH_SIZE < totalProducts) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          console.log('[MIGRATION] Manual migration finished successfully');
        } catch (err) {
          console.error('[MIGRATION] Manual migration background task failed:', err);
        }
      })();

      res.json({ 
        success: true, 
        message: `Đã bắt đầu quá trình đẩy ${totalProducts} sản phẩm lên Cloud. Quá trình này chạy ngầm, vui lòng kiểm tra lại sau vài phút.` 
      });
    } catch (err: any) {
      console.error('Manual migration trigger failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/reset-cloud-sync', async (req, res) => {
    try {
      // Force reset quota flag before trying to get instance
      isQuotaExhausted = false;
      saveQuotaStatus();
      
      const firestore = await getFirestoreInstance(true);
      if (!firestore) return res.status(500).json({ error: 'Firestore not initialized' });

      debugLog('[ADMIN] Starting Cloud Reset & Sync...');
      
      // 1. Delete all products from Firestore
      const snapshot = await firestore.collection('products').get();
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const batch = firestore.batch();
        const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      
      debugLog('[ADMIN] Firestore products cleared.');

      // 2. Sync from SQLite
      const products = db.prepare('SELECT * FROM products').all() as any[];
      let count = 0;

      for (let i = 0; i < products.length; i += 400) {
        const batch = firestore.batch();
        const chunk = products.slice(i, i + 400);
        
        chunk.forEach(p => {
          const docRef = firestore.collection('products').doc(String(p.externalId));
          batch.set(docRef, {
            externalId: p.externalId,
            name: p.name,
            image: p.image,
            originalPrice: p.originalPrice,
            discountPrice: p.discountPrice,
            numericPrice: p.numericPrice,
            category: p.category,
            badge: p.badge,
            affiliateUrl: p.affiliateUrl,
            videoUrl: p.videoUrl,
            discountPercent: p.discountPercent,
            soldCount: p.soldCount,
            numericSoldCount: p.numericSoldCount,
            updatedAt: new Date(),
            createdAt: new Date()
          });
          count++;
        });
        
        await batch.commit();
      }

      productCache.clear();
      res.json({ success: true, message: `Đã xóa Cloud và đồng bộ lại ${count} sản phẩm từ Local.` });
    } catch (err: any) {
      console.error('Reset Cloud Sync error:', err);
      res.status(500).json({ error: err.message });
    }
  });



  app.post('/api/admin/reset-firebase-config', async (req, res) => {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // We keep the projectId but clear the databaseId to force a re-discovery or re-setup
        config.firestoreDatabaseId = "";
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Đã xóa ID database cũ. Vui lòng yêu cầu AI thiết lập lại Firebase.' });
      } else {
        res.status(404).json({ error: 'Không tìm thấy file cấu hình.' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/test-sheet', async (req, res) => {
    console.log('[TEST-SHEET] Starting test for URL:', GOOGLE_SHEET_CSV_URL);
    try {
      const response = await axios.get(GOOGLE_SHEET_CSV_URL, { 
        timeout: 60000,
        responseType: 'text',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      console.log('[TEST-SHEET] Response status:', response.status);
      const contentType = response.headers['content-type'] || '';
      console.log('[TEST-SHEET] Content-Type:', contentType);

      if (contentType.includes('text/html')) {
        console.error('[TEST-SHEET] Error: Received HTML instead of CSV.');
        return res.status(400).json({ 
          success: false, 
          error: 'Sheet chưa được "Xuất bản lên web" dưới dạng CSV. Vui lòng kiểm tra lại cấu hình trong Google Sheets.' 
        });
      }
      
      const firstLine = response.data.split('\n')[0];
      console.log('[TEST-SHEET] Success. Sample:', firstLine.substring(0, 50));
      res.json({ 
        success: true, 
        contentType, 
        sample: firstLine.substring(0, 100),
        url: GOOGLE_SHEET_CSV_URL
      });
    } catch (error: any) {
      console.error('[TEST-SHEET] Exception:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        url: GOOGLE_SHEET_CSV_URL
      });
    }
  });

  app.get('/api/admin/sheet-config', authenticateAdmin, (req, res) => {
    res.json({
      sheetId: GOOGLE_SHEET_ID,
      gid: GOOGLE_SHEET_GID,
      csvUrl: GOOGLE_SHEET_CSV_URL,
      hasAdminPassword: !!ADMIN_PASSWORD
    });
  });

  app.post('/api/admin/update-password', authenticateAdmin, (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });
    
    try {
      ADMIN_PASSWORD = password;
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_password', password);
      res.json({ success: true, message: 'Đã cập nhật mật khẩu thành công' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update password' });
    }
  });

  app.post('/api/admin/verify-password', authenticateAdmin, (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Mật khẩu không chính xác' });
    }
  });

  app.get('/api/admin/db-stats', (req, res) => {
    try {
      const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
      const categoryCount = db.prepare('SELECT COUNT(DISTINCT category) as count FROM products').get() as { count: number };
      const lastSync = db.prepare("SELECT value FROM settings WHERE key = 'last_sync_time'").get() as { value: string };
      
      res.json({
        productCount: productCount.count,
        categoryCount: categoryCount.count,
        lastSync: lastSync?.value || lastSyncTime,
        sheetId: GOOGLE_SHEET_ID,
        gid: GOOGLE_SHEET_GID
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch DB stats' });
    }
  });

  app.get('/api/admin/export-json', (req, res) => {
    try {
      const products = db.prepare('SELECT * FROM products').all();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=products_export.json');
      res.send(JSON.stringify(products, null, 2));
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to export JSON' });
    }
  });

  app.post('/api/admin/import-json', async (req, res) => {
    const products = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Invalid data format. Expected an array of products.' });
    }

    try {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO products (
          externalId, name, fullName, searchName, image, category, 
          originalPrice, discountPrice, discountPercent, badge, 
          soldCount, affiliateUrl, description, rating, reviewCount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((items) => {
        for (const p of items) {
          insert.run(
            p.externalId || null,
            p.name,
            p.fullName || p.name,
            p.searchName || (p.name ? p.name.toLowerCase() : ''),
            p.image || '',
            (p.category || 'Tất cả').trim(),
            p.originalPrice || '0',
            p.discountPrice || '0',
            p.discountPercent || '0%',
            p.badge || 'Hot',
            p.soldCount || '0',
            p.affiliateUrl || '',
            p.description || '',
            p.rating || 5,
            p.reviewCount || 0
          );
        }
      });

      transaction(products);
      res.json({ success: true, count: products.length });
    } catch (err: any) {
      console.error('[IMPORT ERROR]', err);
      res.status(500).json({ error: 'Failed to import JSON' });
    }
  });

  app.post('/api/admin/update-sheet-config', authenticateAdmin, (req, res) => {
    const { sheetId, gid } = req.body;
    try {
      if (sheetId) {
        GOOGLE_SHEET_ID = sheetId;
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('GOOGLE_SHEET_ID', sheetId);
      }
      if (gid) {
        GOOGLE_SHEET_GID = gid;
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('GOOGLE_SHEET_GID', gid);
      }
      updateSheetUrl();
      console.log('[CONFIG] Updated and persisted Google Sheets URL:', GOOGLE_SHEET_CSV_URL);
      res.json({ success: true, url: GOOGLE_SHEET_CSV_URL });
    } catch (err: any) {
      console.error('[CONFIG] Failed to update settings:', err);
      res.status(500).json({ error: 'Failed to save settings to database' });
    }
  });

  app.get('/api/admin/export-csv', (req, res) => {
    try {
      const products = db.prepare('SELECT * FROM products').all();
      const worksheet = XLSX.utils.json_to_sheet(products);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=products_export.csv');
      res.send(csv);
    } catch (error: any) {
      console.error('[EXPORT ERROR] Failed:', error);
      res.status(500).json({ error: 'Failed to export CSV' });
    }
  });

  app.post('/api/admin/clear-local', authenticateAdmin, async (req, res) => {
    try {
      // 1. Clear SQLite
      db.prepare('DELETE FROM products').run();
      
      // 2. Clear Static Files
      const dataDir = path.join(process.cwd(), 'public', 'data');
      const productsDir = path.join(dataDir, 'products');
      if (fs.existsSync(productsDir)) {
        fs.rmSync(productsDir, { recursive: true, force: true });
        fs.mkdirSync(productsDir, { recursive: true });
      }
      
      // 3. Reset categories and meta
      if (fs.existsSync(path.join(dataDir, 'categories.json'))) {
        fs.writeFileSync(path.join(dataDir, 'categories.json'), JSON.stringify([]));
      }
      if (fs.existsSync(path.join(dataDir, 'meta.json'))) {
        fs.writeFileSync(path.join(dataDir, 'meta.json'), JSON.stringify({ totalProducts: 0, lastUpdate: new Date().toISOString(), categories: [] }));
      }
      if (fs.existsSync(path.join(dataDir, 'search-index.json'))) {
        fs.writeFileSync(path.join(dataDir, 'search-index.json'), JSON.stringify([]));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[CLEAR] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/import-from-local-json', authenticateAdmin, async (req, res) => {
    try {
      const localPath = path.join(process.cwd(), 'products.json');
      const partFiles = fs.readdirSync(process.cwd()).filter(f => f.startsWith('products_part') && f.endsWith('.json')).sort();
      
      let data: any[] = [];

      if (partFiles.length > 0) {
        console.log(`[IMPORT] Found multi-part files: ${partFiles.join(', ')}`);
        for (const file of partFiles) {
          let parsed: any = JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8'));
          let partItems: any[] = [];
          
          if (Array.isArray(parsed)) {
            partItems = parsed;
          } else if (parsed && parsed.products && Array.isArray(parsed.products)) {
            partItems = parsed.products;
          }
          
          if (partItems.length > 0) {
            data = data.concat(partItems);
          }
        }
      } else if (fs.existsSync(localPath)) {
        let parsed: any = JSON.parse(fs.readFileSync(localPath, 'utf8'));
        if (Array.isArray(parsed)) {
          data = parsed;
        } else if (parsed && parsed.products && Array.isArray(parsed.products)) {
          data = parsed.products;
        }
      } else {
        return res.status(404).json({ error: 'Không tìm thấy file products.json hoặc products_part*.json ở thư mục gốc.' });
      }

      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: 'Định dạng file JSON không hợp lệ hoặc không có dữ liệu.' });
      }

      const count = await processData(data);
      res.json({ success: true, count, message: `Đã nhập thành công ${count} sản phẩm từ ${partFiles.length || 1} file.` });
    } catch (error: any) {
      console.error('[IMPORT] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/sync-to-static', async (req, res) => {
    try {
      debugLog('[API] Sync to Static JSON requested');
      // Fetch all products from SQLite
      const products = db.prepare('SELECT * FROM products').all();
      
      if (products.length === 0) {
        return res.status(400).json({ success: false, error: 'Không có dữ liệu trong SQLite để xuất. Vui lòng đồng bộ Google Sheets trước.' });
      }
      
      await saveStaticData(products);
      res.json({ success: true, count: products.length });
    } catch (error: any) {
      console.error('[API] Sync to Static Error:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post('/api/admin/sync-google-sheets', async (req, res) => {
    try {
      const count = await syncGoogleSheets(true);
      res.json({ success: true, count });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to sync with Google Sheets' });
    }
  });

  app.post('/api/admin/trigger-deploy', async (req, res) => {
    const deployHookUrl = VERCEL_DEPLOY_HOOK_URL || process.env.VERCEL_DEPLOY_HOOK_URL;
    if (!deployHookUrl) {
      return res.status(400).json({ error: 'VERCEL_DEPLOY_HOOK_URL is not configured' });
    }

    try {
      const response = await axios.post(deployHookUrl);
      res.json({ success: true, message: 'Re-deployment triggered successfully', data: response.data });
    } catch (error: any) {
      console.error('[DEPLOY ERROR] Failed to trigger deploy hook:', error.message);
      res.status(500).json({ error: 'Failed to trigger re-deployment. Check VERCEL_DEPLOY_HOOK_URL.' });
    }
  });

  app.post('/api/admin/upload-csv', authenticateAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      let data: any[] = [];

      if (fileExtension === '.json') {
        const jsonData = fs.readFileSync(req.file.path, 'utf8');
        const parsed = JSON.parse(jsonData);
        // If it's an object with a products array, use that
        if (!Array.isArray(parsed) && parsed.products && Array.isArray(parsed.products)) {
          data = parsed.products;
        } else if (Array.isArray(parsed)) {
          data = parsed;
        } else {
          return res.status(400).json({ error: 'Định dạng file JSON không hợp lệ (phải là mảng hoặc object chứa mảng products).' });
        }
      } else {
        const fileData = fs.readFileSync(req.file.path, 'utf8');
        const workbook = XLSX.read(fileData, { type: 'string', raw: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
      }

      const count = await processData(data);
      
      // Update sync stats
      lastSyncTime = Date.now();
      lastSyncCount = count;
      lastSyncError = '';

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({ success: true, count });
    } catch (error: any) {
      console.error('[UPLOAD ERROR] Failed:', error);
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: error.message || 'Failed to process uploaded CSV' });
    }
  });

  // NEW: Endpoint to split large JSON into small chunks for static hosting
  app.post('/api/admin/split-large-json', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const jsonData = fs.readFileSync(req.file.path, 'utf8');
      const parsed = JSON.parse(jsonData);
      let data: any[] = [];

      if (Array.isArray(parsed)) {
        data = parsed;
      } else if (parsed.products && Array.isArray(parsed.products)) {
        data = parsed.products;
      } else {
        return res.status(400).json({ error: 'JSON must be an array or contain a "products" array.' });
      }

      console.log(`[SPLIT] Processing ${data.length} items from ${req.file.originalname}`);
      
      // Use the existing saveStaticData function to split into chunks
      await saveStaticData(data);

      // Also save as products.json for the build script
      fs.writeFileSync(path.join(process.cwd(), 'products.json'), JSON.stringify(data));

      // NEW: Split into 3 parts for GitHub as requested by user
      const partSize = Math.ceil(data.length / 3);
      for (let i = 0; i < 3; i++) {
        const part = data.slice(i * partSize, (i + 1) * partSize);
        fs.writeFileSync(path.join(process.cwd(), `products_part${i + 1}.json`), JSON.stringify(part));
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({ 
        success: true, 
        count: data.length, 
        message: `Đã chia nhỏ ${data.length} sản phẩm thành các file JSON trong thư mục public/data và tạo 3 file products_part1.json, products_part2.json, products_part3.json ở thư mục gốc. Bạn có thể tải mã nguồn về để lấy các file này.` 
      });
    } catch (error: any) {
      console.error('[SPLIT ERROR] Failed:', error);
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: error.message || 'Failed to split JSON' });
    }
  });

  // Auto-sync disabled as per user request for manual sync only
  /*
  setInterval(() => {
    syncGoogleSheets().catch(err => {
      if (!isQuotaError(err)) {
        console.error('Scheduled sync failed:', err);
      }
    });
  }, 5 * 60 * 1000);
  
  // Initial sync on start - happens almost immediately
  setTimeout(() => {
    syncGoogleSheets().catch(err => {
      if (!isQuotaError(err)) {
        console.error('Initial sync failed:', err);
      }
    });
  }, 2000);
  */

  // API to download the entire project as ZIP
  app.get('/api/admin/download-project', authenticateAdmin, (req, res) => {
    console.log('[DOWNLOAD] Starting project ZIP generation...');
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    res.attachment('shopee-pro-shop-source.zip');

    archive.on('error', (err) => {
      console.error('[DOWNLOAD] Archive error:', err);
      if (!res.headersSent) {
        res.status(500).send({ error: err.message });
      }
    });

    archive.on('warning', (err) => {
      console.warn('[DOWNLOAD] Archive warning:', err);
    });

    archive.on('end', () => {
      console.log('[DOWNLOAD] Archive generation finished. Total bytes:', archive.pointer());
    });

    archive.pipe(res);

    // Add files and directories
    const rootDir = process.cwd();
    console.log('[DOWNLOAD] Root directory:', rootDir);
    const items = fs.readdirSync(rootDir);

    items.forEach(item => {
      const fullPath = path.join(rootDir, item);
      const stats = fs.statSync(fullPath);

      // Exclude heavy or unnecessary folders
      if (['node_modules', '.next', 'dist', '.git', '.cache', 'shopee-pro-shop-source.zip'].includes(item)) {
        return;
      }

      console.log(`[DOWNLOAD] Adding ${stats.isDirectory() ? 'directory' : 'file'}: ${item}`);
      if (stats.isDirectory()) {
        archive.directory(fullPath, item);
      } else {
        archive.file(fullPath, { name: item });
      }
    });

    archive.finalize();
  });

  // Catch-all for API routes that don't match to prevent falling through to Vite/SPA fallback
  app.all('/api/*', (req, res) => {
    res.status(404).json({ 
      error: 'API route not found', 
      message: `Đường dẫn API '${req.path}' không tồn tại.`,
      path: req.path 
    });
  });

  // Explicitly handle missing static JSON files to avoid SPA fallback
  app.get('/data/*.json', (req, res, next) => {
    const filePath = path.join(process.cwd(), 'public', req.path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found', path: req.path });
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.error('[SERVER] createViteServer() started');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    console.error('[SERVER] createViteServer() finished');
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  // Global error handler to ensure JSON responses for all errors
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[GLOBAL ERROR]', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  });

  return app;
}

let appInstance: any;

async function startServer() {
  const app = await createApp();
  const PORT = 3000;
  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Force Firebase initialization on startup
    try {
      await getFirestoreInstance();
    } catch (e: any) {
      debugLog(`Initial Firebase connection failed: ${e.message}`);
    }
  });
  server.timeout = 600000; // 10 minutes timeout for large uploads
}

if (process.env.NODE_ENV !== 'production') {
  startServer();
}

export default async (req: any, res: any) => {
  if (!appInstance) {
    appInstance = await createApp();
  }
  return appInstance(req, res);
};

debugLog('--- server.ts module loading finished ---');
