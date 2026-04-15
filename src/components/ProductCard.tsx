import React from 'react';
import { motion } from 'motion/react';
import { ExternalLink, ShoppingCart, Heart } from 'lucide-react';
import { Product, formatPrice, formatDiscount, formatSoldCount } from '../constants';

interface ProductCardProps {
  product: Product;
}

export const ProductCard = React.memo(({ product }: ProductCardProps) => {
  const optimizedImage = (product.image && product.image.includes('susercontent.com') && !product.image.includes('_tn'))
    ? `${product.image}_tn` 
    : (product.image || null);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full border border-gray-100 overflow-hidden relative"
    >
      <a 
        href={product.affiliateUrl || '#'} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block relative aspect-square overflow-hidden bg-gray-50"
      >
        <img 
          src={optimizedImage} 
          alt={product.name} 
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        
        {/* Badges */}
        <div className="absolute top-0 left-0 flex flex-col gap-1">
          {product.badge && (
            <div className="bg-shopee text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg shadow-sm">
              {product.badge}
            </div>
          )}
          <div className="bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-r-md shadow-sm w-fit">
            Yêu thích
          </div>
        </div>

        {/* Discount Tag */}
        {formatDiscount(product.discountPercent, product.originalPrice, product.discountPrice) && (
          <div className="absolute top-0 right-0 bg-yellow-400 text-shopee font-bold text-[10px] px-1.5 py-0.5 rounded-bl-lg z-10 shadow-sm">
            {formatDiscount(product.discountPercent, product.originalPrice, product.discountPrice)}
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <div className="bg-white/90 p-2 rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <ShoppingCart className="w-4 h-4 text-shopee" />
          </div>
          <div className="bg-white/90 p-2 rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
            <Heart className="w-4 h-4 text-red-500" />
          </div>
        </div>
      </a>

      <div className="p-3 flex flex-col flex-grow">
        <div className="mb-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{product.category}</span>
          <h3 className="text-xs font-bold text-gray-800 line-clamp-2 group-hover:text-shopee transition-colors leading-tight h-8 mt-0.5">
            {product.name}
          </h3>
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-shopee flex items-baseline">
              {formatPrice(product.discountPrice)}
              <span className="text-[10px] ml-0.5 font-bold">đ</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-400 line-through flex items-baseline">
                {formatPrice(product.originalPrice)}
                <span className="text-[8px] ml-0.5 font-medium">đ</span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-100 uppercase">
                Freeship
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-medium">
              {formatSoldCount(product.soldCount, 'Đã bán ') || `Đã bán ${Math.floor(Math.random() * 1000)}`}
            </span>
          </div>

          <a 
            href={product.affiliateUrl || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full bg-shopee text-white text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm hover:bg-shopee-hover transition-all active:scale-95"
          >
            MUA NGAY
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  );
});

ProductCard.displayName = 'ProductCard';

export const ProductSkeleton = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
    <div className="aspect-square bg-gray-200" />
    <div className="p-3 space-y-3">
      <div className="h-3 bg-gray-200 rounded w-1/3" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded" />
        <div className="h-3 bg-gray-200 rounded w-4/5" />
      </div>
      <div className="h-6 bg-gray-200 rounded w-1/2" />
      <div className="h-8 bg-gray-200 rounded w-full" />
    </div>
  </div>
);
