import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Zap, TrendingUp, Heart, Plus, ExternalLink } from 'lucide-react';
import { Product, CATEGORIES_WITH_ICONS, formatPrice, formatDiscount, formatSoldCount } from '../constants';
import { ProductCard } from './ProductCard';

interface ShopeeSectionsProps {
  allProducts: Product[];
  categories: { name: string, image: string, count: number }[];
  onCategorySelect: (category: string) => void;
  activeCategory: string;
}

export const ShopeeSections = React.memo(({ allProducts, categories, onCategorySelect, activeCategory }: ShopeeSectionsProps) => {
  return (
    <div className="max-w-7xl mx-auto px-4 space-y-8 py-8">
      <CategorySection categories={categories} onCategorySelect={onCategorySelect} activeCategory={activeCategory} />
      <FlashSaleSection allProducts={allProducts} />
      <TopSearchSection allProducts={allProducts} />
      <DynamicRecommendationsSection allProducts={allProducts} />
    </div>
  );
});
ShopeeSections.displayName = 'ShopeeSections';

const CategorySection = React.memo(({ categories, onCategorySelect, activeCategory }: { 
  categories: { name: string, image: string, count: number }[], 
  onCategorySelect: (category: string) => void,
  activeCategory: string
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (categories.length === 0) return null;

  const initialCount = 10; // Show 1 row on large screens initially
  const displayedCategories = isExpanded ? categories : categories.slice(0, initialCount - 1);

  return (
    <section className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Danh Mục Sản Phẩm</h2>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-shopee text-xs font-bold flex items-center gap-1 hover:underline"
        >
          {isExpanded ? 'Thu gọn' : 'Xem thêm'}
          <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
        <div 
          onClick={() => onCategorySelect('Tất cả')}
          className={`flex flex-col items-center p-4 border-r border-b border-gray-50 cursor-pointer transition-all group ${activeCategory === 'Tất cả' ? 'bg-shopee/5' : 'hover:bg-gray-50'}`}
        >
          <div className={`w-14 h-14 mb-3 flex items-center justify-center rounded-2xl transition-all duration-300 ${activeCategory === 'Tất cả' ? 'bg-shopee text-white shadow-lg shadow-shopee/20' : 'bg-gray-100 text-gray-400 group-hover:scale-110'}`}>
            <Zap className="w-7 h-7" />
          </div>
          <span className={`text-[11px] text-center font-bold line-clamp-2 leading-tight transition-colors ${activeCategory === 'Tất cả' ? 'text-shopee' : 'text-gray-700'}`}>
            Tất cả deal
          </span>
        </div>

        {displayedCategories.map((cat, idx) => (
          <div 
            key={idx} 
            onClick={() => onCategorySelect(cat.name)}
            className={`flex flex-col items-center p-4 border-r border-b border-gray-50 cursor-pointer transition-all group ${activeCategory === cat.name ? 'bg-shopee/5' : 'hover:bg-gray-50'}`}
          >
            <div className="w-14 h-14 mb-3 relative overflow-hidden rounded-2xl bg-gray-100 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-110">
              <img 
                src={cat.image || null} 
                alt={cat.name} 
                loading="lazy"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className={`absolute inset-0 transition-opacity ${activeCategory === cat.name ? 'bg-shopee/10 opacity-100' : 'bg-black/0 group-hover:bg-black/5'}`} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className={`text-[11px] text-center font-bold line-clamp-2 leading-tight transition-colors ${activeCategory === cat.name ? 'text-shopee' : 'text-gray-700'}`}>
                {cat.name}
              </span>
              <span className="text-[9px] text-gray-400 font-medium">{cat.count} SP</span>
            </div>
          </div>
        ))}
        
        {!isExpanded && categories.length > initialCount - 1 && (
          <div 
            onClick={() => setIsExpanded(true)}
            className="flex flex-col items-center justify-center p-4 border-r border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-all group"
          >
            <div className="w-14 h-14 mb-3 flex items-center justify-center rounded-2xl bg-gray-100 text-gray-400 group-hover:scale-110 transition-all">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-[11px] text-center font-bold text-shopee">
              Xem thêm
            </span>
          </div>
        )}
      </div>
    </section>
  );
});
CategorySection.displayName = 'CategorySection';

const FlashSaleSection = React.memo(({ allProducts }: { allProducts: Product[] }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 1, minutes: 39, seconds: 47 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59, hours: prev.hours };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const flashSaleProducts = useMemo(() => {
    if (allProducts.length === 0) return [];
    const result = [];
    const indices = new Set<number>();
    const count = Math.min(allProducts.length, 6);
    while (indices.size < count) {
      indices.add(Math.floor(Math.random() * allProducts.length));
    }
    for (const idx of indices) {
      result.push(allProducts[idx]);
    }
    return result;
  }, [allProducts]);

  if (flashSaleProducts.length === 0) return null;

  return (
    <section className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-shopee fill-shopee" />
            <span className="text-2xl font-black text-shopee italic tracking-tighter">FLASH SALE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-black text-white px-1.5 py-0.5 rounded font-bold text-sm">
              {String(timeLeft.hours).padStart(2, '0')}
            </span>
            <span className="font-bold">:</span>
            <span className="bg-black text-white px-1.5 py-0.5 rounded font-bold text-sm">
              {String(timeLeft.minutes).padStart(2, '0')}
            </span>
            <span className="font-bold">:</span>
            <span className="bg-black text-white px-1.5 py-0.5 rounded font-bold text-sm">
              {String(timeLeft.seconds).padStart(2, '0')}
            </span>
          </div>
        </div>
        <button className="text-shopee text-sm font-medium flex items-center gap-1 hover:underline">
          Xem tất cả <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {flashSaleProducts.map((product, idx) => (
          <ProductCard key={`${product.id}-${idx}`} product={product} />
        ))}
      </div>
  </section>
);
});
FlashSaleSection.displayName = 'FlashSaleSection';

const TopSearchSection = React.memo(({ allProducts }: { allProducts: Product[] }) => {
  const topSearchProducts = useMemo(() => {
    if (allProducts.length === 0) return [];
    const result = [];
    const indices = new Set<number>();
    const count = Math.min(allProducts.length, 15);
    while (indices.size < count) {
      indices.add(Math.floor(Math.random() * allProducts.length));
    }
    for (const idx of indices) {
      result.push(allProducts[idx]);
    }
    return result;
  }, [allProducts]);

  if (topSearchProducts.length === 0) return null;

  return (
    <section className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-gray-100">
        <h2 className="text-lg font-bold text-shopee uppercase tracking-wider">TÌM KIẾM HÀNG ĐẦU</h2>
        <button className="text-shopee text-sm font-medium flex items-center gap-1 hover:underline">
          Xem Tất Cả <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-4 min-w-max pb-2">
          {topSearchProducts.map((product, idx) => {
            const optimizedImage = (product.image && product.image.includes('susercontent.com') && !product.image.includes('_tn'))
              ? `${product.image}_tn` 
              : (product.image || null);
              
            return (
              <a 
                key={`${product.id}-${idx}`} 
                href={product.affiliateUrl || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-32 sm:w-40 group cursor-pointer relative flex flex-col"
              >
              <div className="relative aspect-square mb-2 overflow-hidden rounded-lg">
                <img 
                  src={optimizedImage} 
                  alt={product.name} 
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-0 left-0 bg-orange-600 text-white font-bold text-[10px] px-2 py-1 rounded-br-lg">
                  TOP
                </div>
                {formatDiscount(product.discountPercent, product.originalPrice, product.discountPrice) && (
                  <div className="absolute top-0 right-0 bg-yellow-400 text-shopee font-bold text-[10px] px-1.5 py-0.5 rounded-bl-lg z-10">
                    {formatDiscount(product.discountPercent, product.originalPrice, product.discountPrice)}
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-yellow-300 text-[10px] py-1 text-center font-bold border-t border-white/10">
                  {formatSoldCount(product.soldCount, 'Bán ') || `Bán ${Math.floor(Math.random() * 50) + 1}k+`} / tháng
                </div>
              </div>
              <div className="text-[11px] sm:text-xs font-bold text-gray-800 line-clamp-2 group-hover:text-shopee transition-colors leading-tight mb-1">
                {product.name}
              </div>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-sm font-bold text-shopee flex items-baseline">
                  {formatPrice(product.discountPrice)}
                  <span className="text-[8px] ml-0.5 font-bold">đ</span>
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 line-through flex items-baseline">
                    {formatPrice(product.originalPrice)}
                    <span className="text-[7px] ml-0.5 font-medium">đ</span>
                  </span>
                  {product.discountPercent && Number(product.discountPercent) > 0 && (
                    <span className="text-[9px] font-bold text-shopee">
                      -{product.discountPercent}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 mb-2">
                <span className="text-[7px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-100 uppercase">
                  Freeship
                </span>
              </div>
              <div className="mt-auto">
                <div className="bg-shopee text-white text-[10px] font-bold py-1.5 rounded-md text-center flex items-center justify-center gap-1 shadow-sm group-hover:bg-shopee-hover transition-colors">
                  MUA NGAY
                  <ExternalLink className="w-2.5 h-2.5" />
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  </section>
);
});
TopSearchSection.displayName = 'TopSearchSection';

const DynamicRecommendationsSection = React.memo(({ allProducts }: { allProducts: Product[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 for right, -1 for left

  const productsToDisplay = useMemo(() => {
    if (allProducts.length === 0) return [];
    const result = [];
    for (let i = 0; i < 5; i++) {
      const index = (currentIndex + i) % allProducts.length;
      result.push(allProducts[index]);
    }
    return result;
  }, [allProducts, currentIndex]);

  useEffect(() => {
    if (allProducts.length === 0) return;
    const interval = setInterval(() => {
      setDirection(Math.random() > 0.5 ? 1 : -1);
      setCurrentIndex(prev => (prev + 5) % allProducts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [allProducts.length]);

  if (productsToDisplay.length === 0) return null;

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  return (
    <section className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 flex flex-col items-center border-b border-gray-100">
        <h2 className="text-xl font-bold text-shopee uppercase tracking-widest relative">
          GỢI Ý HÔM NAY
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-shopee rounded-full" />
        </h2>
      </div>
      <div className="p-6 relative h-[320px] overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="absolute inset-0 p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4"
          >
            {productsToDisplay.map((product, idx) => {
              const optimizedImage = (product.image && product.image.includes('susercontent.com') && !product.image.includes('_tn'))
                ? `${product.image}_tn` 
                : (product.image || null);
                
              return (
                <a 
                  key={`${product.id}-${idx}`} 
                  href={product.affiliateUrl || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group cursor-pointer flex flex-col"
                >
                  <div className="relative aspect-square mb-2 overflow-hidden rounded-lg border border-gray-100">
                    <img 
                      src={optimizedImage} 
                      alt={product.name} 
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <Heart className="w-4 h-4 text-shopee" />
                    </div>
                    {formatDiscount(product.discountPercent, product.originalPrice, product.discountPrice) && (
                      <div className="absolute top-0 right-0 bg-yellow-400 text-shopee font-bold text-[10px] px-1.5 py-0.5 rounded-bl-lg z-10">
                        {formatDiscount(product.discountPercent, product.originalPrice, product.discountPrice)}
                      </div>
                    )}
                    {product.badge && (
                      <div className="absolute top-0 left-0 bg-shopee text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg">
                        {product.badge}
                      </div>
                    )}
                  </div>
                <div className="text-xs font-medium text-gray-800 line-clamp-2 mb-1 group-hover:text-shopee transition-colors">
                  {product.name}
                </div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="text-sm font-bold text-shopee flex items-baseline">
                    {formatPrice(product.discountPrice)}
                    <span className="text-[8px] ml-0.5 font-bold">đ</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 line-through flex items-baseline">
                      {formatPrice(product.originalPrice)}
                      <span className="text-[7px] ml-0.5 font-medium">đ</span>
                    </span>
                    {product.discountPercent && Number(product.discountPercent) > 0 && (
                      <span className="text-[9px] font-bold text-shopee">
                        -{product.discountPercent}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start mb-2">
                  <span className="text-[7px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-100 uppercase">
                    Freeship
                  </span>
                  <span className="text-[9px] text-yellow-600 font-bold mt-0.5">
                    {formatSoldCount(product.soldCount, 'Đã bán ') || `Đã bán ${Math.floor(Math.random() * 1000)}`}
                  </span>
                </div>
                <div className="mt-auto">
                  <div className="bg-shopee text-white text-[10px] font-bold py-1.5 rounded-md flex items-center justify-center gap-1 shadow-sm group-hover:bg-shopee-hover transition-colors">
                    MUA NGAY
                    <ExternalLink className="w-2.5 h-2.5" />
                  </div>
                </div>
              </a>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  </section>
);
});
DynamicRecommendationsSection.displayName = 'DynamicRecommendationsSection';
