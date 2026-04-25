import React, { useState, useMemo, useEffect, useRef, memo, useDeferredValue, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import { FixedSizeList as List } from 'react-window';
import { 
  ShoppingBag, 
  CheckCircle, 
  TrendingUp, 
  ShieldCheck, 
  RefreshCw, 
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Facebook,
  Instagram,
  Twitter,
  Plus,
  Trash2,
  X,
  Upload,
  Download,
  Settings,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  Mail,
  Phone,
  Search,
  FileUp,
  AlertTriangle,
  Cloud,
  Lock,
  LayoutGrid,
  Database,
  Save,
  ShieldAlert,
  Rocket,
  FileJson,
  ArrowDown,
  Info,
  Heart
} from 'lucide-react';
import { CATEGORIES, Product, PRODUCTS, formatPrice, formatDiscount, formatSoldCount } from './constants';
import { auth, loginWithGoogle, logout, onAuthStateChanged, User } from './firebase';
import { ShopeeSections } from './components/ShopeeSections';
import { ProductCard, ProductSkeleton } from './components/ProductCard';
import { BenefitItem } from './components/BenefitItem';
import Fuse from 'fuse.js';
import slugify from 'slugify';



// Helper to remove Vietnamese tones
const removeVietnameseTones = (str: string): string => {
  if (!str) return '';
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
  // Some system encode combined accent as individual characters
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
  str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư
  // Remove extra spaces
  str = str.replace(/ + /g, " ");
  str = str.trim();
  return str;
};

export default function App() {



  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('newest');
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 1000000));



  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const loaderRef = useRef<HTMLDivElement>(null);

  const [isPending, startTransition] = React.useTransition();

  const [diverseProducts, setDiverseProducts] = useState<Product[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [adminTab, setAdminTab] = useState('manual');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [visibleCount, setVisibleCount] = useState(7);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    originalPrice: '0',
    discountPrice: '0',
    category: 'Tất cả',
    badge: 'Hot',
    discountPercent: '0%',
    soldCount: '0',
    affiliateUrl: '',
    image: ''
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);
  const [forceLocal, setForceLocal] = useState(false);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [showDemo, setShowDemo] = useState(true);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingSheet, setIsTestingSheet] = useState(false);
  const [sheetConfig, setSheetConfig] = useState<any>({ sheetId: '', gid: '' });
  const [dbStats, setDbStats] = useState<any>(null);
  const [isUpdatingSheet, setIsUpdatingSheet] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSyncingLocalJson, setIsSyncingLocalJson] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [usingFirestore, setUsingFirestore] = useState(false);
  const [includeProductsInBackup, setIncludeProductsInBackup] = useState(true);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isSplittingJson, setIsSplittingJson] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appConfig, setAppConfig] = useState<any>({
    GOOGLE_SHEET_ID: "",
    GOOGLE_SHEET_GID: "",
    VITE_FIREBASE_API_KEY: "",
    VITE_FIREBASE_AUTH_DOMAIN: "",
    VITE_FIREBASE_PROJECT_ID: "",
    VITE_FIREBASE_STORAGE_BUCKET: "",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "",
    VITE_FIREBASE_APP_ID: ""
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [tempSheetUrl, setTempSheetUrl] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Handle Search Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle Search Submit (on Enter)
  const handleSearchSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    startTransition(() => {
      setActiveSearchQuery(searchQuery);
    });
    scrollToDeals();
  };



  // Memoized handlers
  const handleCategorySelect = useCallback((category: string) => {
    setActiveCategory(category);
    scrollToDeals();
  }, []);




  const [categories, setCategories] = useState<{ name: string, image: string, count: number }[]>([]);
  const [searchIndex, setSearchIndex] = useState<any[]>([]);
  const [fuse, setFuse] = useState<any>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchIndexLoaded, setIsSearchIndexLoaded] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string>('');
  const [meta, setMeta] = useState<any>(null);

  const fetchMeta = async () => {
    try {
      const res = await fetch('/data/meta.json');
      if (res.ok) {
        const data = await res.json();
        setMeta(data);
      } else {
        // Fallback to basic meta info from API
        const resProd = await fetch('/api/products?limit=1');
        if (resProd.ok) {
          const dataProd = await resProd.json();
          setMeta({
            totalProducts: dataProd.total,
            lastUpdate: new Date().toISOString(),
            categories: []
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch meta:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/data/categories.json');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      } else {
        // Fallback to API
        const resApi = await fetch('/api/categories');
        if (resApi.ok) {
          const data = await resApi.json();
          setCategories(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchSearchIndex = useCallback(async () => {
    if (isSearchIndexLoaded || isSearchLoading) return searchIndex;
    
    setIsSearchLoading(true);
    setSearchStatus('Đang tối ưu dữ liệu tìm kiếm...');
    try {
      const res = await fetch('/data/search-index.json');
      if (res.ok) {
        const data = await res.json();
        setSearchIndex(data);
        const fuseInstance = new Fuse(data, {
          keys: [
            { name: 'n', weight: 2 },
            { name: 'n_n', weight: 1.5 },
            { name: 'c', weight: 1 }
          ],
          threshold: 0.3, // Slightly stricter for better relevance
          distance: 100,
          ignoreLocation: true,
          useExtendedSearch: true,
          includeScore: true
        });
        setFuse(fuseInstance);
        setIsSearchIndexLoaded(true);
        setSearchStatus('');
        return data;
      }
    } catch (error) {
      console.error('Failed to fetch search index:', error);
      setSearchStatus('Lỗi tải dữ liệu tìm kiếm');
    } finally {
      setIsSearchLoading(false);
    }
    return [];
  }, [isSearchIndexLoaded, isSearchLoading, searchIndex]);

  useEffect(() => {
    if (isAuthReady && user) {
      fetchSyncStatus();
    }
  }, [isAuthReady, user]);

  useEffect(() => {
    if (isSettingsOpen && user) {
      fetchDbStats();
      fetchAppConfig();
    }
  }, [isSettingsOpen, user]);

  const fetchAppConfig = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/config');
      if (res.ok) {
        const data = await res.json();
        setAppConfig(data);
        // Also update sheetConfig for backward compatibility in UI
        if (data.GOOGLE_SHEET_ID && data.GOOGLE_SHEET_GID) {
          setSheetConfig({ sheetId: data.GOOGLE_SHEET_ID, gid: data.GOOGLE_SHEET_GID });
        }
      }
    } catch (e) {
      console.error('Failed to fetch app config:', e);
    }
  };

  const handleAdminLogin = () => {
    if (adminPasswordInput === 'Chuate6789@') {
      setIsAdminAuthenticated(true);
      toast.success('Đăng nhập quản trị viên thành công');
    } else {
      toast.error('Mật khẩu không chính xác');
    }
  };

  const handleSaveAppConfig = async () => {
    setIsSavingConfig(true);
    console.log('[CONFIG] Saving app config:', appConfig);
    try {
      const res = await fetchWithAuth('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appConfig)
      });
      if (res.ok) {
        toast.success('Đã lưu cấu hình thành công');
        toast.info('Hãy bấm "Đồng bộ từ Google Sheets" để cập nhật sản phẩm mới', { duration: 5000 });
        fetchAppConfig();
      } else {
        toast.error('Lưu cấu hình thất bại');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const fetchDiverseProducts = async () => {
    try {
      // Try to get from page 1 of 'all' products first (fastest)
      const res = await fetch('/data/products/all/1.json');
      if (res.ok) {
        const data = await res.json();
        // Shuffle the 100 products from page 1
        const shuffled = [...data.products].sort(() => Math.random() - 0.5);
        setDiverseProducts(shuffled);
        return;
      }
      
      // Fallback to API
      const resApi = await fetch(`/api/products?limit=50&sort=random&seed=${sessionSeed}`);
      if (resApi.ok) {
        const data = await resApi.json();
        setDiverseProducts(data.products || []);
      }
    } catch (e) {
      console.error('Failed to fetch diverse products:', e);
    }
  };

  useEffect(() => {
    fetchMeta();
    fetchCategories();
    fetchProducts(1, false);
    fetchDiverseProducts();
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const fetchWithAuth = async (url: string, options: any = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  };

  const handleScrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  const fetchDbStats = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/db-stats');
      if (res.ok) {
        const data = await res.json();
        setDbStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch DB stats:', e);
    }
  };

  const handleUpdateSheetConfig = async () => {
    setIsUpdatingSheet(true);
    try {
      const res = await fetchWithAuth('/api/admin/update-sheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetConfig)
      });
      if (res.ok) {
        toast.success('Đã cập nhật cấu hình Google Sheets');
        fetchSyncStatus();
      } else {
        toast.error('Cập nhật thất bại');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    } finally {
      setIsUpdatingSheet(false);
    }
  };

  const handleExportJson = async () => {
    setIsExportingJson(true);
    try {
      const response = await fetchWithAuth('/api/admin/export-json');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'products_export.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Đã xuất file JSON thành công');
    } catch (e) {
      toast.error('Xuất file thất bại');
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingJson(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        setIsImportingJson(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            toast.success(`Đã nhận file ${file.name} và xử lý ${result.count} sản phẩm thành công!`);
            fetchSyncStatus();
            fetchDbStats();
            fetchProducts(1, false);
          } catch (e) {
            toast.success(`Đã tải lên file ${file.name} thành công!`);
          }
        } else {
          toast.error('Tải file lên thất bại. Vui lòng thử lại.');
        }
        e.target.value = '';
      }
    };

    const user = auth.currentUser;
    if (!user) {
      toast.error('Vui lòng đăng nhập để thực hiện tác vụ này');
      setIsImportingJson(false);
      return;
    }

    user.getIdToken().then(token => {
      xhr.open('POST', '/api/admin/upload-csv', true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    }).catch(err => {
      toast.error('Lỗi xác thực');
      setIsImportingJson(false);
    });
  };

  const handleSplitJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSplittingJson(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetchWithAuth('/api/admin/split-large-json', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message, { duration: 10000 });
        fetchSyncStatus();
        fetchDbStats();
        fetchProducts(1, false);
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsSplittingJson(false);
      if (e.target) e.target.value = '';
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/sync-status');
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
        setUsingFirestore(data.usingFirestore);
        if (data.sheetId && data.gid) {
          setSheetConfig({ sheetId: data.sheetId, gid: data.gid });
        }
      }
    } catch (e) {
      console.error('Failed to fetch sync status:', e);
    }
  };

  const checkDbStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetchWithAuth('/api/admin/db-status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (e) {
      console.error('Failed to check db status:', e);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleSyncGoogleSheets = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetchWithAuth('/api/admin/sync-google-sheets', { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);
      if (data.success) {
        toast.success(data.message || 'Đồng bộ thành công!');
        fetchSyncStatus();
        fetchProducts(1, false);
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsSyncing(false);
    }
  };

  const [isDeploying, setIsDeploying] = useState(false);
  const handleTriggerDeploy = async () => {
    setIsDeploying(true);
    try {
      const res = await fetchWithAuth('/api/admin/trigger-deploy', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã kích hoạt re-deploy trên Vercel! Vui lòng đợi 1-2 phút.');
      } else {
        toast.error(data.error || 'Lỗi kích hoạt re-deploy');
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleToggleLocalOnly = async (enabled: boolean) => {
    try {
      const res = await fetchWithAuth('/api/admin/toggle-local-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchSyncStatus();
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleToggleCloudSync = async (enabled: boolean) => {
    try {
      const res = await fetchWithAuth('/api/admin/toggle-cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchSyncStatus();
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleResetQuota = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/reset-quota', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchSyncStatus();
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa TẤT CẢ sản phẩm?')) return;
    try {
      const res = await fetchWithAuth('/api/admin/clear-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchProducts(1, false);
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/admin/add-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setNewProduct({
          name: '',
          originalPrice: '0',
          discountPrice: '0',
          category: 'Tất cả',
          badge: 'Hot',
          discountPercent: '0%',
          soldCount: '0',
          affiliateUrl: '',
          image: ''
        });
        fetchProducts(1, false);
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetchWithAuth('/api/admin/upload-csv', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchProducts(1, false);
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    }
  };

  const DatabaseStatusChecker = memo(({ status, isChecking, onCheck }: any) => {
    if (!status) return (
      <button onClick={onCheck} disabled={isChecking} className="w-full py-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-gray-500 text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
        {isChecking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
        Kiểm tra trạng thái Database
      </button>
    );

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${status.connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-sm font-medium text-gray-700">Database: {status.type}</span>
          </div>
          <button onClick={onCheck} disabled={isChecking} className="p-1.5 hover:bg-white rounded-lg transition-colors shadow-sm">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isChecking ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
            <div className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">Sản phẩm</div>
            <div className="text-lg font-bold text-blue-700">{status.productCount}</div>
          </div>
          <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100/50">
            <div className="text-[10px] text-purple-500 font-bold uppercase tracking-wider mb-1">Dung lượng</div>
            <div className="text-lg font-bold text-purple-700">{status.size}</div>
          </div>
        </div>
      </div>
    );
  });

  const AdminProductRow = ({ index, style }: any) => {
    const product = products[index];
    if (!product) return null;

    return (
      <div style={style} className="px-2 py-1">
        <div className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
            <img src={product.image || null} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex-grow min-w-0">
            <h4 className="text-sm font-bold text-gray-900 truncate">{product.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-shopee">{formatPrice(product.discountPrice)}đ</span>
              <span className="text-[10px] text-gray-400 line-through">{formatPrice(product.originalPrice)}đ</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.open(product.affiliateUrl, '_blank')}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-shopee transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button 
              onClick={async () => {
                if (!window.confirm('Xóa sản phẩm này?')) return;
                try {
                  const res = await fetchWithAuth(`/api/admin/delete-product/${product.id}`, { method: 'DELETE' });
                  const data = await res.json();
                  if (data.success) {
                    toast.success(data.message);
                    fetchProducts(1, false);
                  }
                } catch (e) {
                  toast.error('Lỗi kết nối server');
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim()) return toast.error('Vui lòng nhập tên snapshot');
    setIsSavingSnapshot(true);
    try {
      const res = await fetchWithAuth('/api/admin/save-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: snapshotName })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setSnapshotName('');
        checkDbStatus();
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (name: string) => {
    if (!window.confirm(`Khôi phục snapshot "${name}"? Dữ liệu hiện tại sẽ bị ghi đè.`)) return;
    setIsRestoringSnapshot(true);
    try {
      const res = await fetchWithAuth('/api/admin/restore-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchProducts(1, false);
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsRestoringSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async (name: string) => {
    if (!window.confirm(`Xóa snapshot "${name}"?`)) return;
    try {
      const res = await fetchWithAuth(`/api/admin/delete-snapshot/${name}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        checkDbStatus();
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    try {
      const res = await fetchWithAuth(`/api/admin/export-backup?includeProducts=${includeProductsInBackup}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shopee_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Đã xuất file backup');
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingBackup(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetchWithAuth('/api/admin/import-backup', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchProducts(1, false);
        fetchSyncStatus();
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsImportingBackup(false);
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  const handleMigrateToCloud = async () => {
    if (!window.confirm('Chuyển toàn bộ dữ liệu lên Cloud (Firestore)?')) return;
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      const res = await fetchWithAuth('/api/admin/migrate-to-cloud', { method: 'POST' });
      const data = await res.json();
      setMigrationResult(data);
      if (data.success) {
        toast.success(data.message);
        fetchSyncStatus();
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleTestSheet = async () => {
    setIsTestingSheet(true);
    setTestResult(null);
    try {
      const res = await fetchWithAuth('/api/admin/test-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetConfig)
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsTestingSheet(false);
    }
  };

  const fetchProducts = async (pageNum = 1, isLoadMore = false, customCategory?: string, customSearch?: string, customLimit?: number, customSort?: string) => {
    try {
      if (!isLoadMore) setIsLoading(true);
      
      const currentSearch = customSearch !== undefined ? customSearch : activeSearchQuery;
      const currentCategory = customCategory || activeCategory;
      const currentLimit = customLimit || 100;
      const currentSort = customSort || sortBy;

      const mapFromIndex = (item: any) => ({
        id: item.i,
        name: item.n,
        category: item.c,
        discountPrice: item.p,
        originalPrice: item.op,
        image: item.img,
        affiliateUrl: item.u,
        discountPercent: item.pct,
        soldCount: item.s,
        ratingCount: item.rc,
        likesCount: item.lc,
        ratingScore: item.rs,
        badge: item.b,
        numericPrice: item.np,
        numericSoldCount: item.ns
      });

      // 1. Handle Search or Sort (Client-side using Index)
      if (currentSearch || currentSort !== 'newest') {
        let indexToUse = searchIndex;
        if (!isSearchIndexLoaded) {
          indexToUse = await fetchSearchIndex();
        }
        
        if (indexToUse && indexToUse.length > 0) {
          let results: any[] = [];

          if (currentSearch) {
            // We need to use fuse, but if it was just created in fetchSearchIndex, 
            // the state 'fuse' might not be updated yet.
            // However, fetchSearchIndex sets the fuse state.
            // For safety, if fuse is null but indexToUse is not, we can either wait or use a local fuse.
            let localFuse = fuse;
            if (!localFuse) {
              localFuse = new Fuse(indexToUse, {
                keys: [
                  { name: 'n', weight: 2 },
                  { name: 'n_n', weight: 1.5 },
                  { name: 'c', weight: 1 }
                ],
                threshold: 0.35,
                distance: 100,
                ignoreLocation: true,
                useExtendedSearch: true,
                includeScore: true
              });
            }

            const normalizedSearch = removeVietnameseTones(currentSearch).toLowerCase();
            
            // Try exact match or very close match first
            let fuseResults = localFuse.search(currentSearch);
            
            // If few results, try searching by individual words with mandatory inclusion
            if (fuseResults.length < 15 && currentSearch.trim().includes(' ')) {
              const words = currentSearch.trim().split(/\s+/).filter(w => w.length > 2);
              if (words.length > 0) {
                // Extended search: 'word means include word
                // We combine them with OR to get more results but keep them relevant
                const broadQuery = words.map(w => `'${w}`).join(' '); 
                const broadResults = localFuse.search(broadQuery);
                
                const seenIds = new Set(fuseResults.map((r: any) => r.item.i));
                broadResults.forEach((r: any) => {
                  if (!seenIds.has(r.item.i)) {
                    // Give broad results a slightly worse score to keep them below direct matches
                    r.score = (r.score || 0) + 0.1; 
                    fuseResults.push(r);
                    seenIds.add(r.item.i);
                  }
                });
              }
            }

            // Final fallback: search by normalized name if still few results
            if (fuseResults.length === 0) {
              fuseResults = localFuse.search(normalizedSearch);
            }

            // Sort by score
            fuseResults.sort((a: any, b: any) => (a.score || 0) - (b.score || 0));
            results = fuseResults.map((r: any) => r.item);
          } else {
            // No search, just filtering by category if needed
            results = currentCategory && currentCategory !== 'Tất cả' 
              ? indexToUse.filter((p: any) => p.c === currentCategory)
              : [...indexToUse];
          }

          // Apply Sorting
          if (currentSort === 'price_asc') {
            results.sort((a, b) => (a.np || 0) - (b.np || 0));
          } else if (currentSort === 'price_desc') {
            results.sort((a, b) => (b.np || 0) - (a.np || 0));
          } else if (currentSort === 'popular') {
            results.sort((a, b) => (b.ns || 0) - (a.ns || 0));
          } else if (currentSort === 'random') {
            // Use a stable random sort based on session seed
            const seed = String(sessionSeed).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            results.sort((a, b) => {
              const hashA = (String(a.i).split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) + seed) % 1000;
              const hashB = (String(b.i).split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) + seed) % 1000;
              return hashA - hashB;
            });
          }

          const mappedResults = results.map(mapFromIndex);
          const paginatedResults = mappedResults.slice((pageNum - 1) * currentLimit, pageNum * currentLimit);
          
          if (isLoadMore) {
            setProducts(prev => [...prev, ...paginatedResults]);
          } else {
            setProducts(paginatedResults);
          }
          setTotalProducts(mappedResults.length);
          setHasMore(mappedResults.length > pageNum * currentLimit);
          setIsLoading(false);
          if (mappedResults.length > 0) setShowDemo(false);

          // Pre-fetch next page JSON for even smoother scrolling
          if (mappedResults.length > pageNum * currentLimit && !currentSearch && currentSort === 'newest') {
            const nextPage = pageNum + 1;
            const categoryPath = currentCategory === 'Tất cả' ? 'all' : slugify(currentCategory, { lower: true });
            fetch(`/data/products/${categoryPath}/${nextPage}.json`).catch(() => {});
          }
          return;
        }
      }

      // 2. Handle Category/All (Newest or Fallback - use pre-paginated static files)
      let path = '/data/products/all';
      if (currentCategory && currentCategory !== 'Tất cả') {
        const catSlug = slugify(currentCategory, { lower: true, strict: true, locale: 'vi' });
        path = `/data/products/${catSlug}`;
      }

      const res = await fetch(`${path}/${pageNum}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data.products && data.products.length > 0) {
          setShowDemo(false);
        }
        if (isLoadMore) {
          setProducts(prev => [...prev, ...data.products]);
        } else {
          setProducts(data.products);
        }
        setTotalProducts(data.total);
        setHasMore(data.page < data.totalPages);
        setIsLoading(false);
        return;
      }

      if (!isLoadMore) setProducts([]);
      setHasMore(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      if (!isLoadMore) setProducts([]);
      setIsLoading(false);
    }
  };


  useEffect(() => {
    setPage(1);
    fetchProducts(1, false, activeCategory, activeSearchQuery, 100, sortBy);
  }, [activeCategory, activeSearchQuery, sortBy]);

  // Infinite Scroll Logic
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct({ ...newProduct, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };















  // Infinite Scroll & Pre-fetching Logic
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchProducts(nextPage, true, activeCategory, activeSearchQuery, 100, sortBy);
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '1000px' // Aggressive pre-fetch (1000px from bottom)
      }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, page]);

  const displayedProducts = useMemo(() => products, [products]);

  const scrollToDeals = () => {
    document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' });
  };

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <div className="min-h-screen flex flex-col">
        <motion.div
          className="fixed top-0 left-0 right-0 h-1 bg-shopee z-[100] origin-left"
          style={{ scaleX }}
        />
      {/* Top Contact Bar */}
      <div className="bg-gray-900 text-white py-2 text-[11px] md:text-xs font-medium border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-4">
            <a href="tel:0364284837" className="flex items-center gap-1.5 hover:text-shopee transition-colors">
              <Phone className="w-3 h-3" />
              0364284837
            </a>
            <a href="mailto:lehoangnang888@gmail.com" className="flex items-center gap-1.5 hover:text-shopee transition-colors">
              <Mail className="w-3 h-3" />
              lehoangnang888@gmail.com
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://www.facebook.com/hoangnang.le.5/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-shopee transition-colors">
              <Facebook className="w-3 h-3" />
              Facebook
            </a>
          </div>
        </div>
      </div>

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-shopee p-1.5 rounded-lg">
              <ShoppingBag className="text-white w-5 h-5" />
            </div>
            <div className="flex flex-col leading-tight hidden sm:flex">
              <span className="font-bold text-lg md:text-xl tracking-tight text-shopee">
                Shopee Official Mall Vietnam
              </span>
              <span className="text-[10px] md:text-xs text-gray-500 font-medium tracking-wider uppercase">
                Hệ Sinh Thái Mua Sắm Thông Minh • Uy Tín • Đẳng Cấp Hàng Đầu
              </span>
            </div>
          </div>

          {/* Search Bar in Header */}
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchQuery}
              onFocus={fetchSearchIndex}
              onChange={(e) => {
                handleSearchChange(e);
                fetchSearchIndex();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit(e);
                }
              }}
              className={`w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-shopee focus:ring-2 focus:ring-shopee/20 outline-none transition-all text-sm ${isPending || isSearchLoading ? 'opacity-70' : ''}`}
            />
            {(isPending || isSearchLoading) && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-shopee"></div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-6 text-sm font-medium text-gray-600">
            <div className="hidden lg:flex items-center gap-6">
              <a href="#deals" className="hover:text-shopee transition-colors">Deal Hôm Nay</a>
              <a href="#benefits" className="hover:text-shopee transition-colors">Tại Sao Chọn Chúng Tôi</a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full"
            >
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-100">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Dịch Vụ Mua Sắm & Kết Nối Thương Hiệu Chính Hãng
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white rounded-full text-sm shadow-xl shadow-pink-200/50 animate-pulse hover:scale-110 transition-transform cursor-default">
                  <Heart className="w-4 h-4 fill-white animate-bounce" />
                  <span className="font-stylish text-lg tracking-wider drop-shadow-md"> Liên Tục Cập Nhật Sản Phẩm 24/7 Mới Nhất</span>
                </div>
              </div>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.15] mb-8 tracking-tight">
                Shopee Official Mall Vietnam <br className="hidden md:block" />
                <span className="text-shopee">Hệ Sinh Thái Mua Sắm Thông Minh • Uy Tín • Đẳng Cấp Hàng Đầu</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed max-w-5xl">
                Chào mừng bạn đến với nền tảng kết nối thương hiệu hàng đầu Việt Nam. Với mạng lưới hơn 30.000+ gian hàng chính hãng và hàng triệu khách hàng tin dùng, chúng tôi tự hào mang đến giải pháp mua sắm an tâm, tiện lợi và những bộ sưu tập sản phẩm được chọn lọc khắt khe nhất dành riêng cho bạn.
              </p>
              <button 
                onClick={scrollToDeals}
                className="bg-shopee hover:bg-shopee-hover text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-shopee/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                Xem deal hot hôm nay
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
          
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 -z-10 w-1/2 h-full opacity-10 pointer-events-none hidden lg:block">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-shopee rounded-full blur-[120px]"></div>
          </div>
        </section>

        {/* Shopee Style Sections */}
        <ShopeeSections 
          allProducts={diverseProducts.length > 0 ? diverseProducts : products} 
          categories={categories}
          onCategorySelect={handleCategorySelect}
          activeCategory={activeCategory}
        />

        {/* Catalog Section */}
        <section id="deals" className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Danh Mục Sản Phẩm</h2>
                <p className="text-gray-500">
                  {totalProducts > 0 
                    ? `Khám phá ${totalProducts.toLocaleString()} deal hời đang chờ bạn` 
                    : 'Khám phá hàng ngàn deal hời đang chờ bạn'}
                </p>
              </div>
              
              <div className="flex flex-col gap-6">
              </div>
            </div>

            {/* Sorting Bar */}
            <div className="bg-gray-50 p-3 rounded-xl mb-6 flex flex-wrap items-center gap-4 border border-gray-100">
              <span className="text-sm text-gray-500 font-medium ml-2">Sắp xếp theo:</span>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => setSortBy('newest')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${sortBy === 'newest' ? 'bg-shopee text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                >
                  Mới Nhất
                </button>
                <button 
                  onClick={() => setSortBy('popular')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${sortBy === 'popular' ? 'bg-shopee text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                >
                  Bán Chạy
                </button>
                <button 
                  onClick={() => setSortBy('random')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${sortBy === 'random' ? 'bg-shopee text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                >
                  Gợi Ý
                </button>
                
                <div className="relative group">
                  <select 
                    value={sortBy.startsWith('price_') ? sortBy : ''}
                    onChange={(e) => setSortBy(e.target.value)}
                    className={`appearance-none pl-6 pr-10 py-2 rounded-lg text-sm font-bold transition-all outline-none cursor-pointer ${sortBy.startsWith('price_') ? 'bg-shopee text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                  >
                    <option value="" disabled hidden>Giá</option>
                    <option value="price_asc" className="bg-white text-gray-700">Giá: Thấp đến Cao</option>
                    <option value="price_desc" className="bg-white text-gray-700">Giá: Cao đến Thấp</option>
                  </select>
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${sortBy.startsWith('price_') ? 'text-white' : 'text-gray-400'}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Product Grid */}
            <div className="relative min-h-[400px]">
              {searchStatus && (
                <div className="mb-4 p-3 bg-shopee/5 border border-shopee/10 rounded-xl flex items-center gap-3 animate-pulse">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-shopee"></div>
                  <span className="text-xs font-bold text-shopee">{searchStatus}</span>
                </div>
              )}
              
              {isPending && (
                <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[1px] flex items-center justify-center rounded-3xl pointer-events-none">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-shopee"></div>
                </div>
              )}
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4 product-grid">
              {isLoading && products.length === 0 ? (
                Array.from({ length: 15 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))
              ) : displayedProducts.length > 0 ? (
                displayedProducts.map((product: Product, idx: number) => (
                  <ProductCard 
                    key={`${product.id}-${idx}`} 
                    product={product} 
                  />
                ))
              ) : !isLoading && (
                <div className="col-span-full py-20 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Không tìm thấy sản phẩm</h3>
                  <p className="text-gray-500">Thử tìm kiếm với từ khóa khác hoặc chọn danh mục khác</p>
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategory('Tất cả');
                    }}
                    className="mt-6 text-shopee font-bold hover:underline"
                  >
                    Xóa tất cả bộ lọc
                  </button>
                </div>
              )}
            </div>
            </div>

            {/* Infinite Scroll Loader */}
            <div ref={loaderRef} className="py-10 flex justify-center">
              {isLoading && products.length > 0 && (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shopee"></div>
              )}
              {!hasMore && products.length > 0 && (
                <p className="text-gray-400 text-sm">Đã hiển thị tất cả sản phẩm</p>
              )}
            </div>
          </div>
        </section>

        {/* Admin Modal */}
        <AnimatePresence>
          {isAdminOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAdminOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              >
                {!isAdminAuthenticated ? (
                  <div className="p-12 flex items-center justify-center">
                    <div className="max-w-sm w-full space-y-6">
                      <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-shopee/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Lock className="w-8 h-8 text-shopee" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Xác thực Quản trị viên</h2>
                        <p className="text-sm text-gray-500">Vui lòng nhập mật khẩu để quản lý sản phẩm</p>
                      </div>

                      <div className="space-y-4">
                        <div className="relative">
                          <input 
                            type="password"
                            value={adminPasswordInput}
                            onChange={(e) => setAdminPasswordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                            placeholder="Nhập mật khẩu..."
                            className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-shopee/20 focus:border-shopee outline-none transition-all text-center text-lg tracking-widest"
                            autoFocus
                          />
                        </div>
                        <button 
                          onClick={handleAdminLogin}
                          className="w-full py-4 bg-shopee text-white rounded-2xl font-bold shadow-lg shadow-shopee/20 hover:bg-shopee/90 transition-all active:scale-[0.98]"
                        >
                          Đăng nhập
                        </button>
                        <button 
                          onClick={() => setIsAdminOpen(false)}
                          className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          Hủy bỏ
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                      <h2 className="text-2xl font-bold text-gray-900">Quản lý sản phẩm</h2>
                      <button onClick={() => setIsAdminOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-500" />
                      </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Left Column: Actions */}
                    <div className="space-y-8">
                      {/* Tabs */}
                      <div className="flex p-1 bg-gray-100 rounded-2xl">
                        <button 
                          onClick={() => setAdminTab('manual')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${adminTab === 'manual' ? 'bg-white text-shopee shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <Plus className="w-4 h-4" />
                          Thủ công
                        </button>
                        <button 
                          onClick={() => setAdminTab('bulk-image')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${adminTab === 'bulk-image' ? 'bg-white text-shopee shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <ImageIcon className="w-4 h-4" />
                          Ảnh (Bulk)
                        </button>
                        <button 
                          onClick={() => setAdminTab('google-sheets')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${adminTab === 'google-sheets' ? 'bg-white text-shopee shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Google Sheets
                        </button>
                        <button 
                          onClick={() => setAdminTab('database')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${adminTab === 'database' ? 'bg-white text-shopee shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <Database className="w-4 h-4" />
                          Dữ liệu
                        </button>
                        <button 
                          onClick={() => setAdminTab('settings')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${adminTab === 'settings' ? 'bg-white text-shopee shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <Settings className="w-4 h-4" />
                          Cài đặt
                        </button>
                      </div>

                      {adminTab === 'settings' && (
                        <div className="space-y-6">
                          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-shopee" />
                            Cấu hình hệ thống
                          </h3>
                          
                          {/* Firebase Status Check */}
                          <DatabaseStatusChecker 
                            status={dbStatus} 
                            checking={isCheckingStatus} 
                            checkStatus={checkDbStatus} 
                            handleResetQuota={handleResetQuota}
                            forceLocal={forceLocal}
                            setForceLocal={setForceLocal}
                          />

                          {/* Mode Controls Hidden as requested */}

                          {/* Snapshots Management */}
                          <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100 space-y-4">
                            <h4 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                              <Save className="w-4 h-4 text-purple-600" />
                              Lưu & Khôi phục Cấu hình (Snapshots)
                            </h4>
                            <p className="text-[10px] text-purple-700">
                              Lưu lại toàn bộ cài đặt hiện tại (Firebase, Google Sheets, Mật khẩu) để khôi phục nhanh khi cần.
                            </p>
                            
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                value={snapshotName}
                                onChange={e => setSnapshotName(e.target.value)}
                                placeholder="Tên snapshot (VD: VIP1)"
                                className="flex-1 px-3 py-2 text-xs rounded-lg border border-purple-200 outline-none focus:border-purple-400"
                              />
                              <button 
                                onClick={async () => {
                                  if (!snapshotName) return toast.error('Vui lòng nhập tên snapshot');
                                  setIsSavingSnapshot(true);
                                  try {
                                    const res = await fetchWithAuth('/api/admin/snapshots/save', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ name: snapshotName })
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                      toast.success(data.message);
                                      setSnapshotName('');
                                      checkDbStatus(); // Refresh snapshots list
                                    } else {
                                      toast.error(data.error);
                                    }
                                  } catch (e) {
                                    toast.error('Lỗi kết nối server');
                                  } finally {
                                    setIsSavingSnapshot(false);
                                  }
                                }}
                                disabled={isSavingSnapshot}
                                className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-all"
                              >
                                {isSavingSnapshot ? 'Đang lưu...' : 'Lưu VIP'}
                              </button>
                            </div>

                            {dbStatus?.snapshots && dbStatus.snapshots.length > 0 && (
                              <div className="space-y-2 mt-4">
                                <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Danh sách Snapshots</label>
                                <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1">
                                  {dbStatus.snapshots.map((snap: any) => (
                                    <div key={snap.name} className="flex items-center justify-between p-2 bg-white rounded-lg border border-purple-100 shadow-sm">
                                      <div>
                                        <p className="text-xs font-bold text-gray-700">{snap.name}</p>
                                        <p className="text-[9px] text-gray-400">{new Date(snap.createdAt).toLocaleString('vi-VN')}</p>
                                      </div>
                                      <div className="flex gap-2">
                                        <button 
                                          onClick={async () => {
                                            if (!window.confirm(`Bạn có chắc chắn muốn khôi phục về cài đặt "${snap.name}"?`)) return;
                                            setIsRestoringSnapshot(true);
                                            try {
                                              const res = await fetchWithAuth('/api/admin/snapshots/restore', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ name: snap.name })
                                              });
                                              const data = await res.json();
                                              if (data.success) {
                                                toast.success(data.message);
                                                setTimeout(() => window.location.reload(), 2000);
                                              } else {
                                                toast.error(data.error);
                                              }
                                            } catch (e) {
                                              toast.error('Lỗi kết nối server');
                                            } finally {
                                              setIsRestoringSnapshot(false);
                                            }
                                          }}
                                          disabled={isRestoringSnapshot}
                                          className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded hover:bg-amber-200 transition-all"
                                        >
                                          Khôi phục
                                        </button>
                                        <button 
                                          onClick={async () => {
                                            if (!window.confirm(`Xóa snapshot "${snap.name}"?`)) return;
                                            try {
                                              const res = await fetchWithAuth('/api/admin/snapshots/delete', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ name: snap.name })
                                              });
                                              const data = await res.json();
                                              if (data.success) {
                                                toast.success(data.message);
                                                checkDbStatus();
                                              } else {
                                                toast.error(data.error);
                                              }
                                            } catch (e) {
                                              toast.error('Lỗi kết nối server');
                                            }
                                          }}
                                          className="p-1 text-red-400 hover:text-red-600 transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="pt-4 border-t border-purple-100 space-y-4">
                              <h5 className="text-[11px] font-bold text-purple-900 uppercase">Sao lưu ra tệp (Backup JSON)</h5>
                              <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={includeProductsInBackup}
                                    onChange={e => setIncludeProductsInBackup(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-purple-600"
                                  />
                                  <span className="text-[10px] text-gray-600">Bao gồm cả danh sách sản phẩm</span>
                                </label>
                                
                                <div className="flex gap-2 w-full sm:w-auto">
                                  <button 
                                    onClick={async () => {
                                      setIsExportingBackup(true);
                                      try {
                                        const res = await fetchWithAuth(`/api/admin/backup/export?includeProducts=${includeProductsInBackup}`);
                                        if (!res.ok) throw new Error('Export failed');
                                        
                                        const blob = await res.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `backup_shopee_${new Date().toISOString().split('T')[0]}.json`;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        toast.success('Đã tải xuống tệp backup');
                                      } catch (e) {
                                        toast.error('Lỗi khi xuất backup');
                                      } finally {
                                        setIsExportingBackup(false);
                                      }
                                    }}
                                    disabled={isExportingBackup}
                                    className="flex-1 sm:flex-none px-3 py-2 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-lg hover:bg-purple-200 flex items-center justify-center gap-2"
                                  >
                                    <Download className="w-3 h-3" />
                                    Xuất Backup
                                  </button>

                                  <button 
                                    onClick={() => backupInputRef.current?.click()}
                                    disabled={isImportingBackup}
                                    className="flex-1 sm:flex-none px-3 py-2 bg-white border border-purple-200 text-purple-700 text-[10px] font-bold rounded-lg hover:bg-purple-50 flex items-center justify-center gap-2"
                                  >
                                    <Upload className="w-3 h-3" />
                                    Nhập Backup
                                  </button>
                                  <input 
                                    ref={backupInputRef}
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      
                                      if (!window.confirm('Cảnh báo: Nhập backup sẽ ghi đè toàn bộ cài đặt hiện tại. Bạn có chắc chắn?')) {
                                        e.target.value = '';
                                        return;
                                      }

                                      setIsImportingBackup(true);
                                      try {
                                        const reader = new FileReader();
                                        reader.onload = async (event) => {
                                          try {
                                            const backupData = JSON.parse(event.target?.result as string);
                                            const res = await fetchWithAuth('/api/admin/backup/import', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify(backupData)
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                              toast.success(data.message);
                                              setTimeout(() => window.location.reload(), 2000);
                                            } else {
                                              toast.error(data.error);
                                            }
                                          } catch (err) {
                                            toast.error('Tệp JSON không hợp lệ');
                                          }
                                        };
                                        reader.readAsText(file);
                                      } catch (err) {
                                        toast.error('Lỗi đọc tệp');
                                      } finally {
                                        setIsImportingBackup(false);
                                        e.target.value = '';
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {usingFirestore && (
                            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <Cloud className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-blue-900">Đồng bộ dữ liệu Local lên Cloud</h4>
                                  <p className="text-xs text-blue-700">Nếu bạn mới chuyển sang Cloud Mode và thấy thiếu sản phẩm, hãy nhấn nút bên dưới để tải dữ liệu từ máy chủ lên Firebase.</p>
                                </div>
                              </div>

                              {migrationResult && (
                                <div className={`p-3 rounded-xl text-xs font-medium border ${migrationResult.success ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                  {migrationResult.message}
                                  {migrationResult.success && migrationResult.count !== undefined && ` (${migrationResult.count} sản phẩm)`}
                                </div>
                              )}

                              <button 
                                onClick={async () => {
                                  setIsMigrating(true);
                                  setMigrationResult(null);
                                  try {
                                    const res = await fetchWithAuth('/api/admin/migrate-to-cloud', { method: 'POST' });
                                    const data = await res.json();
                                    if (data.success) {
                                      setMigrationResult({ 
                                        success: true, 
                                        message: 'Đã đồng bộ thành công sản phẩm lên Cloud!',
                                        count: data.count 
                                      });
                                      fetchProducts(1, false);
                                    } else {
                                      setMigrationResult({ success: false, message: 'Lỗi: ' + data.error });
                                    }
                                  } catch (err) {
                                    setMigrationResult({ success: false, message: 'Lỗi kết nối máy chủ' });
                                  } finally {
                                    setIsMigrating(false);
                                  }
                                }}
                                disabled={isMigrating}
                                className={`w-full py-2.5 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm ${isMigrating ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                              >
                                <RefreshCw className={`w-4 h-4 ${isMigrating ? 'animate-spin' : ''}`} />
                                {isMigrating ? 'Đang đồng bộ...' : 'Bắt đầu đồng bộ lên Cloud'}
                              </button>

                              <button 
                                onClick={async () => {
                                  if (!window.confirm('CẢNH BÁO: Thao tác này sẽ XÓA TOÀN BỘ sản phẩm trên Cloud (Firestore) và tải lại từ Local (SQLite). Bạn có chắc chắn muốn tiếp tục?')) return;
                                  setIsMigrating(true);
                                  setMigrationResult(null);
                                  try {
                                    const res = await fetchWithAuth('/api/admin/reset-cloud-sync', { method: 'POST' });
                                    const data = await res.json();
                                    if (data.success) {
                                      setMigrationResult({ 
                                        success: true, 
                                        message: data.message,
                                        count: data.count 
                                      });
                                      fetchSyncStatus();
                                      fetchProducts(1, false);
                                    } else {
                                      setMigrationResult({ success: false, message: 'Lỗi: ' + data.error });
                                    }
                                  } catch (err) {
                                    setMigrationResult({ success: false, message: 'Lỗi kết nối máy chủ' });
                                  } finally {
                                    setIsMigrating(false);
                                  }
                                }}
                                disabled={isMigrating}
                                className={`w-full py-2.5 text-red-600 font-bold rounded-xl border-2 border-red-100 hover:bg-red-50 transition-all flex items-center justify-center gap-2 mt-2`}
                              >
                                <Trash2 className="w-4 h-4" />
                                {isMigrating ? 'Đang xử lý...' : 'Xóa Cloud & Đồng bộ lại từ Local'}
                              </button>
                            </div>
                          )}

                          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-700">
                              <strong>Lưu ý:</strong> Khi chuyển đổi chế độ, dữ liệu có thể không đồng nhất nếu chưa được đồng bộ từ Google Sheets. Bạn nên thực hiện đồng bộ lại sau khi chuyển đổi.
                            </p>
                          </div>

                          <button 
                            onClick={async () => {
                              await logout();
                              setIsAdminOpen(false);
                            }}
                            className="w-full py-3 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Đăng xuất Admin
                          </button>
                        </div>
                      )}

                      {adminTab === 'manual' && (
                        <div className="space-y-6">
                          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-shopee" />
                            Thêm sản phẩm mới
                          </h3>
                          <form onSubmit={handleAddProduct} className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Tên sản phẩm</label>
                              <input 
                                required
                                type="text" 
                                value={newProduct.name}
                                onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-shopee focus:ring-2 focus:ring-shopee/20 outline-none transition-all"
                                placeholder="Ví dụ: Tai nghe Sony WH-1000XM5"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Giá gốc</label>
                                <input 
                                  type="text" 
                                  value={newProduct.originalPrice}
                                  onChange={e => setNewProduct({...newProduct, originalPrice: e.target.value})}
                                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-shopee focus:ring-2 focus:ring-shopee/20 outline-none transition-all"
                                  placeholder="8.990.000đ"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Giá giảm</label>
                                <input 
                                  required
                                  type="text" 
                                  value={newProduct.discountPrice}
                                  onChange={e => setNewProduct({...newProduct, discountPrice: e.target.value})}
                                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-shopee focus:ring-2 focus:ring-shopee/20 outline-none transition-all"
                                  placeholder="6.490.000đ"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Danh mục</label>
                                <select 
                                  value={newProduct.category}
                                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-shopee focus:ring-2 focus:ring-shopee/20 outline-none transition-all bg-white"
                                >
                                  {CATEGORIES.filter(c => c !== 'Tất cả').map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nhãn</label>
                                <select 
                                  value={newProduct.badge}
                                  onChange={e => setNewProduct({...newProduct, badge: e.target.value as any})}
                                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-shopee focus:ring-2 focus:ring-shopee/20 outline-none transition-all bg-white"
                                >
                                  <option value="Deal hot">Deal hot</option>
                                  <option value="Bán chạy">Bán chạy</option>
                                  <option value="Giảm sâu">Giảm sâu</option>
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">% Giảm giá</label>
                                <input 
                                  type="text" 
                                  value={newProduct.discountPercent}
                                  onChange={e => setNewProduct({...newProduct, discountPercent: e.target.value})}
                                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-shopee focus:ring-2 focus:ring-shopee/20 outline-none transition-all"
                                  placeholder="Ví dụ: -50%"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Số lượng đã bán</label>
                                <input 
                                  type="text" 
                                  value={newProduct.soldCount}
                                  onChange={e => setNewProduct({...newProduct, soldCount: e.target.value})}
                                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-shopee focus:ring-2 focus:ring-shopee/20 outline-none transition-all"
                                  placeholder="Ví dụ: 1.2k"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Link Affiliate Shopee</label>
                              <input 
                                required
                                type="url" 
                                value={newProduct.affiliateUrl}
                                onChange={e => setNewProduct({...newProduct, affiliateUrl: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-shopee focus:ring-2 focus:ring-shopee/20 outline-none transition-all"
                                placeholder="https://shopee.vn/..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Ảnh sản phẩm (Tải trực tiếp)</label>
                              <div className="relative group">
                                <input 
                                  required={!newProduct.image}
                                  type="file" 
                                  accept="image/*"
                                  onChange={handleImageUpload}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="w-full aspect-video rounded-2xl border-2 border-dashed border-gray-200 group-hover:border-shopee group-hover:bg-shopee/5 transition-all flex flex-col items-center justify-center gap-3 overflow-hidden">
                                  {newProduct.image ? (
                                    <img src={newProduct.image || null} className="w-full h-full object-cover" />
                                  ) : (
                                    <>
                                      <Upload className="w-8 h-8 text-gray-300 group-hover:text-shopee transition-colors" />
                                      <span className="text-sm text-gray-400 group-hover:text-shopee font-medium">Click để chọn ảnh hoặc kéo thả</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button 
                              type="submit"
                              className="w-full bg-shopee hover:bg-shopee-hover text-white py-4 rounded-xl font-bold shadow-lg shadow-shopee/20 transition-all active:scale-95"
                            >
                              Lưu sản phẩm
                            </button>
                          </form>
                        </div>
                      )}

                      {adminTab === 'database' && (
                        <div className="space-y-6">
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-4">
                            <p className="text-xs text-blue-700 flex items-center gap-2">
                              <Info className="w-4 h-4" />
                              Hệ thống tự động chia nhỏ dữ liệu lớn để tối ưu tốc độ tải trên Vercel.
                            </p>
                          </div>
                          <DatabaseStatusChecker 
                            status={dbStatus} 
                            checking={isCheckingStatus} 
                            checkStatus={checkDbStatus} 
                            handleResetQuota={handleResetQuota}
                            forceLocal={forceLocal}
                            setForceLocal={setForceLocal}
                          />
                          
                          {/* Cloud Management Hidden as requested */}
                          <div className="grid grid-cols-1 gap-4">
                            <div className="p-6 bg-shopee/5 rounded-2xl border border-shopee/10">
                              <h4 className="text-sm font-bold text-shopee mb-2 flex items-center gap-2">
                                <Database className="w-4 h-4" />
                                Quản lý Local (SQLite)
                              </h4>
                              <p className="text-xs text-shopee/70 mb-4">
                                SQLite là cơ sở dữ liệu dự phòng, giúp web hoạt động ngay cả khi không có mạng hoặc hết hạn mức Cloud.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button 
                                  onClick={async () => {
                                    if (!confirm('Bạn có chắc chắn muốn xóa tất cả sản phẩm trong Local?')) return;
                                    try {
                                      const res = await fetchWithAuth('/api/admin/clear-all', { 
                                        method: 'POST'
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        toast.success('Đã xóa sạch dữ liệu Local');
                                        window.location.reload();
                                      }
                                    } catch (e) {
                                      toast.error('Lỗi kết nối server');
                                    }
                                  }}
                                  className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                                >
                                  Xóa sạch dữ liệu Local
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="pt-4 border-t border-gray-100">
                        <button 
                          onClick={handleClearAll}
                          className="w-full text-red-500 hover:bg-red-50 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Xóa tất cả sản phẩm hiện có
                        </button>
                      </div>

                          {adminTab === 'google-sheets' && (
                            <div className="space-y-6">
                              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <RefreshCw className={`w-5 h-5 text-shopee ${isSyncing ? 'animate-spin' : ''}`} />
                                Đồng bộ Google Sheets
                              </h3>

                              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                                <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                                  <Settings className="w-4 h-4" />
                                  Cấu hình Google Sheets
                                </h4>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Dán Link Google Sheets đầy đủ</label>
                                    <input 
                                      type="text" 
                                      placeholder="https://docs.google.com/spreadsheets/d/e/.../pubhtml?gid=..."
                                      className="w-full px-3 py-2 text-xs rounded-lg border border-blue-200 focus:border-shopee outline-none mb-2"
                                      onChange={(e) => {
                                        const url = e.target.value;
                                        // Improved regex to handle various Google Sheets URL formats
                                        const idMatch = url.match(/\/d\/(?:e\/)?([^\/?#]+)/);
                                        const gidMatch = url.match(/gid=([0-9]+)/);
                                        
                                        if (idMatch && idMatch[1]) {
                                          setSheetConfig(prev => ({ ...prev, sheetId: idMatch[1] }));
                                        }
                                        if (gidMatch && gidMatch[1]) {
                                          setSheetConfig(prev => ({ ...prev, gid: gidMatch[1] }));
                                        }
                                      }}
                                    />
                                    <p className="text-[9px] text-blue-500 italic">Dán link "Xuất bản lên web" vào đây, hệ thống sẽ tự động tách ID và GID bên dưới.</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Sheet ID</label>
                                      <input 
                                        type="text" 
                                        value={sheetConfig.sheetId}
                                        onChange={e => setSheetConfig({...sheetConfig, sheetId: e.target.value})}
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-blue-200 focus:border-shopee outline-none bg-white/50"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">GID</label>
                                      <input 
                                        type="text" 
                                        value={sheetConfig.gid}
                                        onChange={e => setSheetConfig({...sheetConfig, gid: e.target.value})}
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-blue-200 focus:border-shopee outline-none bg-white/50"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={handleUpdateSheetConfig}
                                        disabled={isUpdatingConfig}
                                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                                      >
                                        {isUpdatingConfig ? 'Đang cập nhật...' : 'Lưu cấu hình Sheet'}
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          setIsTestingSheet(true);
                                          setTestResult(null);
                                          try {
                                            const res = await fetchWithAuth('/api/admin/test-sheet');
                                            const data = await res.json();
                                            if (data.success) {
                                              setTestResult({ success: true, message: 'Kết nối thành công! Dữ liệu mẫu: ' + data.sample });
                                            } else {
                                              setTestResult({ success: false, message: 'Lỗi kết nối: ' + data.error });
                                            }
                                          } catch (e) {
                                            setTestResult({ success: false, message: 'Lỗi kết nối server.' });
                                          } finally {
                                            setIsTestingSheet(false);
                                          }
                                        }}
                                        disabled={isTestingSheet}
                                        className="px-4 py-2 bg-white border border-blue-200 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                                      >
                                        {isTestingSheet ? 'Đang thử...' : 'Kiểm tra kết nối'}
                                      </button>
                                    </div>
                                    {testResult && (
                                      <div className={`p-3 rounded-lg text-[10px] font-medium border ${testResult.success ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                        {testResult.message}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                            <div className="flex items-center gap-2 mb-4">
                              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200`}>
                                Local Mode (SQLite)
                              </div>
                              {!usingFirestore && (
                                <span className="text-[10px] text-gray-500 italic">Đang sử dụng bộ nhớ tạm thời</span>
                              )}
                            </div>

                            <p className="text-sm text-blue-700 leading-relaxed mb-4">
                              Hệ thống sẽ tự động lấy dữ liệu từ file Google Sheets của bạn. 
                              Dữ liệu hiện tại trên web sẽ được thay thế hoàn toàn bằng dữ liệu mới từ sheet.
                            </p>
                            
                            {syncStatus && syncStatus.lastSyncTime > 0 && (
                              <div className="mb-4 p-3 bg-white/50 rounded-xl border border-blue-200 text-xs text-blue-800">
                                <div className="flex justify-between mb-1">
                                  <span className="font-bold">Lần đồng bộ cuối:</span>
                                  <span>{new Date(syncStatus.lastSyncTime).toLocaleString('vi-VN')}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                  <span className="font-bold">Số sản phẩm trong DB:</span>
                                  <span>{(syncStatus.totalInDb || 0).toLocaleString()} sản phẩm</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="font-bold">Lần đồng bộ cuối:</span>
                                  <span>{syncStatus.lastSyncCount.toLocaleString()} sản phẩm</span>
                                </div>
                                {syncStatus.lastSyncError && (
                                  <div className="mt-2 text-red-600 font-bold">
                                    Lỗi: {syncStatus.lastSyncError}
                                  </div>
                                )}
                                {syncStatus.isQuotaExhausted && (
                                  <div className="mt-2 p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 font-bold flex flex-col gap-2">
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p>Hạn mức Firestore (Quota) đã hết!</p>
                                        <p className="text-[10px] font-normal mt-1">
                                          Google giới hạn 20.000 lượt ghi mỗi ngày. Hệ thống sẽ tạm dừng đồng bộ trong {syncStatus.remainingCooldown ? Math.ceil(syncStatus.remainingCooldown / (60 * 60 * 1000)) : 12}h. Vui lòng chuyển sang <strong>Local Mode</strong> để tiếp tục.
                                        </p>
                                      </div>
                                    </div>
                                    <button 
                                      onClick={handleResetQuota}
                                      className="text-[10px] bg-red-200 hover:bg-red-300 text-red-900 py-1 px-2 rounded transition-colors self-end"
                                    >
                                      Thử reset trạng thái
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            <button 
                              onClick={handleSyncGoogleSheets}
                              disabled={isSyncing || (syncStatus?.isSyncing)}
                              className="w-full bg-shopee hover:bg-shopee-hover disabled:bg-gray-400 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-shopee/20"
                            >
                              {(isSyncing || syncStatus?.isSyncing) ? (
                                <>
                                  <RefreshCw className="w-5 h-5 animate-spin" />
                                  Đang đồng bộ...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-5 h-5" />
                                  Đồng bộ ngay bây giờ
                                </>
                              )}
                            </button>

                            <div className="flex flex-col gap-2 mt-4">
                              <button 
                                onClick={async () => {
                                  const id = toast.loading('Đang xuất dữ liệu ra JSON tĩnh...');
                                  try {
                                    const res = await fetchWithAuth('/api/admin/sync-to-static', { method: 'POST' });
                                    const data = await res.json();
                                    if (data.success) {
                                      toast.success(`Đã xuất ${data.count} sản phẩm ra JSON tĩnh!`, { id });
                                    } else {
                                      toast.error(`Lỗi: ${data.error}`, { id });
                                    }
                                  } catch (e) {
                                    toast.error('Lỗi kết nối server.', { id });
                                  }
                                }}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                              >
                                <FileJson className="w-4 h-4" />
                                Xuất ra JSON tĩnh (Cho Vercel)
                              </button>
                              
                              <button 
                                onClick={async () => {
                                  if (!window.confirm('Bạn có chắc chắn muốn xóa sạch dữ liệu Local (SQLite)?')) return;
                                  try {
                                    const res = await fetchWithAuth('/api/admin/clear-local', { method: 'POST' });
                                    const data = await res.json();
                                    if (data.success) {
                                      toast.success('Đã xóa sạch dữ liệu Local');
                                    }
                                  } catch (e) {
                                    toast.error('Lỗi khi xóa dữ liệu');
                                  }
                                }}
                                className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold rounded-lg transition-colors border border-red-200"
                              >
                                Xóa sạch dữ liệu Local
                              </button>
                            </div>

                            <div className="pt-6 border-t border-gray-100 mt-6">
                              <div className="flex items-center gap-2 mb-2">
                                <Rocket className="w-4 h-4 text-emerald-600" />
                                <h4 className="text-sm font-bold text-gray-900">Triển khai (Vercel)</h4>
                              </div>
                              <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
                                Sau khi đồng bộ dữ liệu thành công, bạn có thể kích hoạt re-deploy trên Vercel để cập nhật các file JSON tĩnh (CDN). Điều này giúp ứng dụng tải nhanh hơn cho người dùng.
                              </p>
                              <button 
                                onClick={handleTriggerDeploy}
                                disabled={isDeploying}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                              >
                                {isDeploying ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Đang gửi yêu cầu...
                                  </>
                                ) : (
                                  <>
                                    <Rocket className="w-4 h-4" />
                                    Kích hoạt Re-deploy (Vercel)
                                  </>
                                )}
                              </button>
                            </div>

                            <button 
                              onClick={async () => {
                                if (!window.confirm('Bạn có chắc chắn muốn chuẩn hóa lại toàn bộ danh mục sản phẩm? Thao tác này sẽ gộp các danh mục nhỏ thành các danh mục lớn (~40 danh mục).')) return;
                                setIsSyncing(true);
                                try {
                                  const response = await fetchWithAuth('/api/admin/normalize-categories', { method: 'POST' });
                                  const data = await response.json();
                                  if (data.success) {
                                    toast.success(data.message);
                                    fetchSyncStatus();
                                  } else {
                                    toast.error(data.error || 'Lỗi khi chuẩn hóa danh mục.');
                                  }
                                } catch (error) {
                                  console.error('Normalization error:', error);
                                  toast.error('Lỗi khi chuẩn hóa danh mục.');
                                } finally {
                                  setIsSyncing(false);
                                }
                              }}
                              disabled={isSyncing || syncStatus?.isSyncing}
                              className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                            >
                              <LayoutGrid className="w-5 h-5" />
                              Chuẩn hóa danh mục (~40 nhóm)
                            </button>

                            <button 
                              onClick={async () => {
                                try {
                                  const user = auth.currentUser;
                                  if (!user) {
                                    toast.error('Vui lòng đăng nhập để thực hiện thao tác này.');
                                    return;
                                  }
                                  const response = await fetchWithAuth('/api/admin/export-csv');
                                  if (!response.ok) {
                                    throw new Error('Failed to export CSV');
                                  }
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'products_export.csv';
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);
                                  toast.success('Đã tải xuống file sao lưu thành công.');
                                } catch (error) {
                                  console.error('Export error:', error);
                                  toast.error('Lỗi khi tải xuống file sao lưu.');
                                }
                              }}
                              className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                            >
                              <Download className="w-5 h-5" />
                              Tải về CSV (Sao lưu)
                            </button>

                            {syncResult && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`mt-3 p-4 rounded-xl text-sm font-bold border shadow-md flex items-center gap-3 ${syncResult.success ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                              >
                                {syncResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                <div>
                                  <p>{syncResult.message}</p>
                                  {syncResult.success && <p className="text-[10px] font-normal mt-0.5">Dữ liệu đã được cập nhật vào kho hàng.</p>}
                                </div>
                              </motion.div>
                            )}

                            {(syncStatus?.isSyncing || isSyncing) && (
                              <button 
                                onClick={async () => {
                                  await fetchWithAuth('/api/admin/sync-status', { 
                                    method: 'POST', 
                                    body: JSON.stringify({ reset: true }), 
                                    headers: { 'Content-Type': 'application/json' } 
                                  });
                                  fetchSyncStatus();
                                  toast.info('Đã đặt lại trạng thái đồng bộ');
                                }}
                                className="w-full mt-2 text-[10px] text-gray-400 hover:text-shopee transition-colors"
                              >
                                Đặt lại trạng thái đồng bộ (nếu bị treo)
                              </button>
                            )}

                            {syncStatus && syncStatus.lastSyncError && syncStatus.lastSyncError.includes('Firestore Error') && (
                              <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-100">
                                <h4 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  Phát hiện lỗi Firestore
                                </h4>
                                <p className="text-xs text-red-700 mb-4">
                                  Hệ thống không thể kết nối đến Database Firebase của bạn. Điều này thường xảy ra khi bạn vừa "Remix" ứng dụng hoặc cấu hình bị sai.
                                </p>
                                <button 
                                  onClick={async () => {
                                    const res = await fetchWithAuth('/api/admin/reset-firebase-config', { method: 'POST' });
                                    const data = await res.json();
                                    if (data.success) {
                                      toast.success(data.message);
                                      fetchSyncStatus();
                                    }
                                  }}
                                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                  Sửa lỗi Database (Reset Config)
                                </button>
                              </div>
                            )}

                            <div className="mt-6 pt-6 border-t border-gray-100">
                              <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <FileUp className="w-4 h-4 text-shopee" />
                                Tải lên file CSV thủ công
                              </h4>
                              <p className="text-[11px] text-gray-500 mb-4">
                                Nếu đồng bộ Google Sheets gặp lỗi, bạn có thể tải file CSV/Excel trực tiếp lên đây.
                              </p>
                              <label className="block">
                                <span className="sr-only">Chọn file</span>
                                <input 
                                  type="file" 
                                  accept=".csv,.xlsx"
                                  onChange={handleUploadCSV}
                                  disabled={isSyncing || syncStatus?.isSyncing}
                                  className="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-xs file:font-semibold
                                    file:bg-shopee/10 file:text-shopee
                                    hover:file:bg-shopee/20
                                    cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </label>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 italic">
                            * Hệ thống tự động đồng bộ mỗi 5 phút để đảm bảo dữ liệu luôn mới nhất.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: List View */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">Sản phẩm hiện có ({totalProducts.toLocaleString()})</h3>
                        {totalProducts > products.length && (
                          <span className="text-[10px] text-gray-400 font-medium">Đang hiển thị {products.length} SP mới nhất</span>
                        )}
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text"
                          placeholder="Tìm kiếm sản phẩm..."
                          value={searchQuery}
                          onChange={handleSearchChange}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSearchSubmit(e);
                            }
                          }}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-shopee/20"
                        />
                      </div>

                      <div className="pr-2 custom-scrollbar">
                        {products.length > 0 ? (
                          <List
                            height={500}
                            itemCount={products.length}
                            itemSize={90}
                            width={'100%'}
                            className="no-scrollbar"
                          >
                            {AdminProductRow}
                          </List>
                        ) : (
                          <div className="py-10 text-center text-gray-400 text-sm">
                            Không có sản phẩm nào
                          </div>
                        )}
                        
                        {hasMore && (
                          <button 
                            onClick={() => {
                              const nextPage = Math.floor(products.length / 50) + 1;
                              fetchProducts(nextPage, true, undefined, undefined);
                            }}
                            className="w-full mt-4 py-3 text-sm font-bold text-shopee hover:bg-shopee/5 rounded-xl transition-colors border border-dashed border-shopee/20"
                          >
                            Xem thêm sản phẩm...
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>

        {/* Benefits Section */}
        <section id="benefits" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Lý do nên mua qua website này</h2>
              <p className="text-gray-600">Chúng tôi cam kết mang lại trải nghiệm mua sắm an toàn và tiết kiệm nhất cho bạn.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <BenefitItem 
                icon={<CheckCircle className="w-8 h-8 text-emerald-500" />}
                title="Chọn lọc deal thật"
                description="Mọi sản phẩm đều được kiểm tra kỹ lưỡng về chất lượng và độ uy tín của shop."
              />
              <BenefitItem 
                icon={<TrendingUp className="w-8 h-8 text-blue-500" />}
                title="Không tăng giá"
                description="Cam kết giá hiển thị là giá thực tế, không có tình trạng nâng giá rồi giảm ảo."
              />
              <BenefitItem 
                icon={<ShieldCheck className="w-8 h-8 text-shopee" />}
                title="Sản Phẩm Chính Hãng"
                description="Ưu tiên các gian hàng Shopee Mall và các shop yêu thích có đánh giá cao."
              />
              <BenefitItem 
                icon={<RefreshCw className="w-8 h-8 text-purple-500" />}
                title="Cập nhật hằng ngày"
                description="Hệ thống tự động cập nhật những deal mới nhất, hot nhất mỗi giờ."
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="footer" className="bg-gray-900 text-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="bg-shopee p-1.5 rounded-lg">
                  <ShoppingBag className="text-white w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xl tracking-tight">
                    Shopee Official Mall Vietnam
                  </span>
                  <span className="text-sm text-shopee font-bold mt-1 uppercase tracking-wider">
                    Hệ Sinh Thái Mua Sắm Thông Minh & Uy Tín Số 1
                  </span>
                </div>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Shopee Official Mall Vietnam là nền tảng shop trưng bày hàng đầu Việt Nam hiện đang kết nối 30.000+ cửa hàng có nhu cầu quảng bá sản phẩm/dịch vụ và mạng lưới 15.000.000+ khách hàng, thúc đẩy tăng trưởng doanh thu bền vững và cung cấp các sản phẩm được yêu thích, chọn lọc kỹ lưỡng nhất hiện nay.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-6">Liên Kết Nhanh</h4>
              <ul className="space-y-4 text-sm text-gray-400">
                <li><a href="#" className="hover:text-shopee transition-colors">Trang chủ</a></li>
                <li><a href="#deals" className="hover:text-shopee transition-colors">Deal hot hôm nay</a></li>
                <li><a href="#benefits" className="hover:text-shopee transition-colors">Về chúng tôi</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-6">Theo Dõi Chúng Tôi</h4>
              <div className="flex gap-4">
                <a href="https://www.facebook.com/hoangnang.le.5/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-shopee transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-shopee transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-shopee transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-yellow-400 hover:text-yellow-500 transition-colors mr-1 font-bold text-lg leading-none"
                >
                  @
                </button>
                <span className="text-xs text-gray-400">
                  © 2026 Shopee Official Mall Vietnam
                  <br />
                  <span className="text-[10px] opacity-70">Hệ Sinh Thái Mua Sắm Thông Minh & Uy Tín Số 1</span>
                </span>
                <button 
                  onClick={() => setIsAdminOpen(true)}
                  className="w-4 h-4 opacity-0 hover:opacity-10 transition-opacity cursor-default"
                  aria-label="Admin"
                />
              </div>
              {meta?.lastUpdated && (
                <div className="flex items-center gap-1.5 text-gray-600 bg-gray-800/30 px-2 py-1 rounded-full">
                  <RefreshCw className="w-3 h-3" />
                  <span>Cập nhật: {new Date(meta.lastUpdated).toLocaleString('vi-VN')}</span>
                </div>
              )}
              {meta?.totalProducts && (
                <div className="flex items-center gap-1.5 text-gray-600 bg-gray-800/30 px-2 py-1 rounded-full">
                  <ShoppingBag className="w-3 h-3" />
                  <span>{meta.totalProducts.toLocaleString()} sản phẩm</span>
                </div>
              )}
            </div>
            <p className="text-center md:text-right">
              Disclaimer: Website chia sẻ các sản phẩm chất lượng, với giá ưu đãi. Chúng tôi không trực tiếp bán hàng.
            </p>
          </div>
        </div>
      </footer>



      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              {!isAdminAuthenticated ? (
                <div className="p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-shopee/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-8 h-8 text-shopee" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Xác thực Quản trị viên</h2>
                    <p className="text-sm text-gray-500">Vui lòng nhập mật khẩu để truy cập Cài đặt</p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <input 
                        type="password"
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                        placeholder="Nhập mật khẩu..."
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-shopee/20 focus:border-shopee outline-none transition-all text-center text-lg tracking-widest"
                        autoFocus
                      />
                    </div>
                    <button 
                      onClick={handleAdminLogin}
                      className="w-full py-4 bg-shopee text-white rounded-2xl font-bold shadow-lg shadow-shopee/20 hover:bg-shopee/90 transition-all active:scale-[0.98]"
                    >
                      Đăng nhập
                    </button>
                    <button 
                      onClick={() => setIsSettingsOpen(false)}
                      className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-shopee" />
                      Cài đặt hệ thống
                    </h2>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="flex-grow overflow-y-auto p-6 space-y-8">
                {/* System Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-shopee" />
                      Cấu hình Hệ thống (Google Sheets & Firebase)
                    </h3>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${syncStatus?.isSyncing ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
                      {syncStatus?.isSyncing ? 'Đang đồng bộ...' : 'Sẵn sàng'}
                    </div>
                  </div>

                  <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase">Dán link Google Sheets (Tự động nhận diện)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={tempSheetUrl}
                          onChange={(e) => setTempSheetUrl(e.target.value)}
                          placeholder="Dán link pubhtml hoặc link chỉnh sửa tại đây..."
                          className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-shopee/20 focus:border-shopee outline-none transition-all"
                        />
                        <button
                          onClick={() => {
                            const url = tempSheetUrl.trim();
                            console.log('[CONFIG] Parsing URL:', url);
                            
                            if (!url || url.length < 10) {
                              toast.error('Vui lòng dán link hợp lệ');
                              return;
                            }
                            
                            // Extract ID - Support multiple formats
                            let sheetId = '';
                            
                            // Try to find the long ID (usually 44+ chars for pubhtml, or standard 44 chars)
                            // Pattern: /d/(ID)/ or /d/e/(ID)/
                            const idMatch = url.match(/\/d\/(?:e\/)?([a-zA-Z0-9_-]{20,})/);
                            if (idMatch) {
                              sheetId = idMatch[1];
                            }
                            
                            // Extract GID
                            let gid = '';
                            const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
                            if (gidMatch) {
                              gid = gidMatch[1];
                            } else if (url.includes('/pubhtml')) {
                              // Sometimes pubhtml doesn't have gid in URL if it's the first sheet, 
                              // but usually it's better to default to '0' if not found
                              gid = '0';
                            }
                            
                            console.log('[CONFIG] Extracted - ID:', sheetId, 'GID:', gid);
                            
                            if (sheetId) {
                              setAppConfig(prev => ({
                                ...prev,
                                GOOGLE_SHEET_ID: sheetId,
                                GOOGLE_SHEET_GID: gid || '0'
                              }));
                              toast.success(`Đã nhận diện: ID (${sheetId.substring(0, 8)}...) và GID (${gid || '0'})`);
                              // Optional: clear the input to show it's done
                              // setTempSheetUrl(''); 
                            } else {
                              toast.error('Không tìm thấy Sheet ID. Hãy chắc chắn bạn dán đúng link Google Sheets (link trình duyệt hoặc link pubhtml).');
                            }
                          }}
                          className="px-4 py-2 bg-shopee text-white rounded-xl text-xs font-bold hover:bg-shopee/90 transition-colors whitespace-nowrap"
                        >
                          Cập nhật link
                        </button>
                      </div>
                      <p className="text-[9px] text-gray-400 ml-1 italic">* Dán link rồi bấm "Cập nhật link" để hệ thống tự tách ID và GID.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase">Google Sheet ID</label>
                        <input 
                          type="text"
                          value={appConfig.GOOGLE_SHEET_ID}
                          onChange={(e) => setAppConfig({ ...appConfig, GOOGLE_SHEET_ID: e.target.value })}
                          placeholder="Nhập Sheet ID..."
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-shopee/20 focus:border-shopee outline-none transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase">GID</label>
                        <input 
                          type="text"
                          value={appConfig.GOOGLE_SHEET_GID}
                          onChange={(e) => setAppConfig({ ...appConfig, GOOGLE_SHEET_GID: e.target.value })}
                          placeholder="Thường là 0..."
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-shopee/20 focus:border-shopee outline-none transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200 space-y-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cấu hình Firebase (Tùy chọn)</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 ml-1">API Key</label>
                          <input 
                            type="password"
                            value={appConfig.VITE_FIREBASE_API_KEY}
                            onChange={(e) => setAppConfig({ ...appConfig, VITE_FIREBASE_API_KEY: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-shopee/20 focus:border-shopee outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 ml-1">Project ID</label>
                          <input 
                            type="text"
                            value={appConfig.VITE_FIREBASE_PROJECT_ID}
                            onChange={(e) => setAppConfig({ ...appConfig, VITE_FIREBASE_PROJECT_ID: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-shopee/20 focus:border-shopee outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200 space-y-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cấu hình Vercel (Tùy chọn)</p>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 ml-1">Deploy Hook URL</label>
                        <input 
                          type="text"
                          value={appConfig.VERCEL_DEPLOY_HOOK_URL || ''}
                          onChange={(e) => setAppConfig({ ...appConfig, VERCEL_DEPLOY_HOOK_URL: e.target.value })}
                          placeholder="https://api.vercel.com/v1/integrations/deploy/..."
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-shopee/20 focus:border-shopee outline-none transition-all font-mono"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSaveAppConfig}
                      disabled={isSavingConfig}
                      className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isSavingConfig ? 'Đang lưu...' : 'Lưu tất cả cấu hình'}
                    </button>
                  </div>
                </div>

                {/* SQLite Management */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Database className="w-4 h-4 text-shopee" />
                    Quản lý SQLite & Báo cáo
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100">
                      <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Sản phẩm</p>
                      <p className="text-xl font-black text-orange-900">{dbStats?.productCount || 0}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Danh mục</p>
                      <p className="text-xl font-black text-blue-900">{dbStats?.categoryCount || 0}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={handleSyncGoogleSheets}
                      disabled={isSyncing || syncStatus?.isSyncing}
                      className="w-full bg-shopee hover:bg-shopee-hover text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      Đồng bộ từ Google Sheets lên SQLite
                    </button>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleExportJson}
                        disabled={isExportingJson}
                        className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Xuất JSON
                      </button>
                      <label className={`flex-1 border py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${isImportingJson ? 'bg-gray-100 border-gray-300 text-gray-400' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                        {isImportingJson ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {isImportingJson ? `Đang tải ${uploadProgress}%` : 'Nhập JSON'}
                        <input type="file" accept=".json" onChange={handleImportJson} className="hidden" disabled={isImportingJson} />
                      </label>
                    </div>

                    {isImportingJson && (
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          className="h-full bg-shopee"
                        />
                      </div>
                    )}

                    <button 
                      onClick={async () => {
                        const id = toast.loading('Đang xuất dữ liệu ra JSON tĩnh...');
                        try {
                          const res = await fetchWithAuth('/api/admin/sync-to-static', { method: 'POST' });
                          const data = await res.json();
                          if (data.success) {
                            toast.success(`Đã xuất ${data.count} sản phẩm ra JSON tĩnh!`, { id });
                          } else {
                            toast.error(`Lỗi: ${data.error}`, { id });
                          }
                        } catch (e) {
                          toast.error('Lỗi kết nối server.', { id });
                        }
                      }}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                      <FileJson className="w-4 h-4" />
                      Xuất ra JSON tĩnh (Cho Vercel)
                    </button>

                    <button
                      onClick={async () => {
                        const id = toast.loading('Đang đồng bộ từ products.json (66MB)...');
                        setIsSyncingLocalJson(true);
                        try {
                          const res = await fetchWithAuth('/api/admin/import-from-local-json', { method: 'POST' });
                          const data = await res.json();
                          if (data.success) {
                            toast.success(`Đồng bộ thành công! Đã nạp ${data.count} sản phẩm.`, { id, duration: 5000 });
                            setShowDemo(false);
                            fetchProducts(1, false);
                            fetchDbStats();
                          } else {
                            throw new Error(data.error || 'Lỗi không xác định');
                          }
                        } catch (e: any) {
                          toast.error(`Lỗi đồng bộ: ${e.message}`, { id });
                        } finally {
                          setIsSyncingLocalJson(false);
                        }
                      }}
                      disabled={isSyncingLocalJson}
                      className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-teal-100 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Database className={`w-4 h-4 ${isSyncingLocalJson ? 'animate-spin' : ''}`} />
                      Đồng bộ từ products.json (66MB) vào Code
                    </button>

                    <button
                      onClick={async () => {
                        if (!window.confirm('Anh có chắc chắn muốn XÓA HẾT toàn bộ sản phẩm không? Hành động này không thể hoàn tác.')) return;
                        const id = toast.loading('Đang xóa toàn bộ dữ liệu...');
                        try {
                          const res = await fetchWithAuth('/api/admin/clear-local', { method: 'POST' });
                          const data = await res.json();
                          if (data.success) {
                            toast.success('Đã xóa sạch toàn bộ sản phẩm!', { id });
                            setProducts([]);
                            setCategories([]);
                            setDiverseProducts([]);
                            setTotalProducts(0);
                            setHasMore(false);
                            setActiveCategory('Tất cả');
                            setShowDemo(false);
                          } else {
                            throw new Error(data.error || 'Lỗi không xác định');
                          }
                        } catch (e: any) {
                          toast.error(`Lỗi: ${e.message}`, { id });
                        }
                      }}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xóa sạch toàn bộ sản phẩm
                    </button>
                  </div>
                </div>

                {/* Vercel Actions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-shopee" />
                    Triển khai (Vercel)
                  </h3>
                  <button
                    onClick={handleTriggerDeploy}
                    disabled={isDeploying}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isDeploying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    Kích hoạt Re-deploy (Cập nhật web)
                  </button>

                  <button
                    onClick={async () => {
                      console.log('[CLIENT] Starting project download...');
                      const id = toast.loading('Đang chuẩn bị file ZIP...');
                      try {
                        const res = await fetchWithAuth('/api/admin/download-project');
                        console.log('[CLIENT] Download response status:', res.status);
                        
                        if (!res.ok) {
                          const errorData = await res.json().catch(() => ({}));
                          throw new Error(errorData.error || `Lỗi server: ${res.status}`);
                        }
                        
                        const blob = await res.blob();
                        console.log('[CLIENT] Blob received, size:', blob.size);
                        
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'shopee-pro-shop-source.zip';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        toast.success('Đã tải file ZIP thành công!', { id });
                      } catch (e: any) {
                        console.error('[CLIENT] Download error:', e);
                        toast.error(`Lỗi: ${e.message || 'Không thể tải file ZIP'}`, { id });
                      }
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-green-100 mt-2"
                  >
                    <Download className="w-4 h-4" />
                    Tải toàn bộ mã nguồn (.ZIP)
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                    Hệ thống tự động đồng bộ hằng ngày qua GitHub Actions.<br />
                    Dữ liệu được lưu an toàn trong SQLite và xuất ra JSON để hiển thị.
                  </p>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    )}
  </AnimatePresence>

      {/* Scroll to Bottom Button */}
      <button 
        onClick={handleScrollToBottom}
        className="fixed bottom-24 right-8 z-50 p-3 bg-white text-shopee rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 transition-all active:scale-90 md:flex hidden items-center justify-center"
        title="Cuối trang"
      >
        <ArrowDown className="w-6 h-6" />
      </button>

      {/* Back to Top Button */}
      <button 
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-8 right-8 z-50 p-3 bg-shopee text-white rounded-full shadow-lg hover:bg-shopee-hover transition-all active:scale-90 md:flex hidden items-center justify-center"
      >
        <TrendingUp className="w-6 h-6 rotate-[-90deg]" />
      </button>
    </div>
  );
}

// Components extracted to separate files


