import React, { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Lock, Plus, ImageIcon, RefreshCw, Database, Settings, Save, Trash2, Download, Upload, 
  CheckCircle2, AlertCircle, Clock, Database as DatabaseIcon, Shield, Key, FileText, 
  Search, Edit2, ExternalLink, Trash
} from 'lucide-react';
import { Product } from '../constants';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  onLogin: () => void;
  passwordInput: string;
  setPasswordInput: (val: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  // ... add more props as needed
  children: React.ReactNode;
}

export const AdminModal = memo(({ 
  isOpen, 
  onClose, 
  isAuthenticated, 
  onLogin, 
  passwordInput, 
  setPasswordInput,
  activeTab,
  setActiveTab,
  children
}: AdminModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {!isAuthenticated ? (
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
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onLogin()}
                        placeholder="Nhập mật khẩu..."
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-shopee/20 focus:border-shopee outline-none transition-all text-center text-lg tracking-widest"
                        autoFocus
                      />
                    </div>
                    <button 
                      onClick={onLogin}
                      className="w-full py-4 bg-shopee text-white rounded-2xl font-bold shadow-lg shadow-shopee/20 hover:bg-shopee/90 transition-all active:scale-[0.98]"
                    >
                      Đăng nhập
                    </button>
                    <button 
                      onClick={onClose}
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
                  <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>

                <div className="flex-grow overflow-y-auto p-6">
                  {children}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

AdminModal.displayName = 'AdminModal';
