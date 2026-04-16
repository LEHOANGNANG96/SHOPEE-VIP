export interface Product {
  id: number;
  name: string;
  image: string;
  originalPrice: string;
  discountPrice: string;
  category: string;
  badge?: string;
  affiliateUrl: string;
  videoUrl?: string;
  discountPercent?: string;
  soldCount?: string;
  ratingCount?: string;
  likesCount?: string;
  ratingScore?: string;
}

export const CATEGORIES_WITH_ICONS = [
  { name: 'Thời Trang Nam', icon: 'https://cf.shopee.vn/file/687f3967cb7890a9c0fd951240d393b5_tn' },
  { name: 'Thời Trang Nữ', icon: 'https://cf.shopee.vn/file/75ea42f9dec124484440641fb071bb34_tn' },
  { name: 'Điện Thoại & Phụ Kiện', icon: 'https://cf.shopee.vn/file/316311f4ad30ea31283d582f8c16adbc_tn' },
  { name: 'Thiết Bị Điện Tử', icon: 'https://cf.shopee.vn/file/978b9e4cb61c611aa25da220b9695fed_tn' },
  { name: 'Máy Tính & Laptop', icon: 'https://cf.shopee.vn/file/c3f3675aada2409e741a31246285966f_tn' },
  { name: 'Máy Ảnh & Máy Quay Phim', icon: 'https://cf.shopee.vn/file/ec14fd4fc23a7c3982901c73e8183bc3_tn' },
  { name: 'Đồng Hồ', icon: 'https://cf.shopee.vn/file/86c294aae72f1ed5fd54c169079951a2_tn' },
  { name: 'Giày Dép', icon: 'https://cf.shopee.vn/file/74122b1331420410bc8bc6993d719007_tn' },
  { name: 'Túi Ví', icon: 'https://cf.shopee.vn/file/fa6ada2555e8e51f36f6582454d25ebd_tn' },
  { name: 'Phụ Kiện & Trang Sức Nữ', icon: 'https://cf.shopee.vn/file/8e712455d659de748aba0a8b5fd41cb0_tn' },
  { name: 'Thiết Bị Điện Gia Dụng', icon: 'https://cf.shopee.vn/file/7ab13f8511fad7a2d30ce035d772d4d0_tn' },
  { name: 'Nhà Cửa & Đời Sống', icon: 'https://cf.shopee.vn/file/24b9092c1a2a6afd3811c4357fbb2af7_tn' },
  { name: 'Sắc Đẹp', icon: 'https://cf.shopee.vn/file/ef1f336ecc6f97b790d5aae9916dcb72_tn' },
  { name: 'Sức Khỏe', icon: 'https://cf.shopee.vn/file/49119e1753301d31ea85225044633a4c_tn' },
  { name: 'Mẹ & Bé', icon: 'https://cf.shopee.vn/file/099edde1ad31db359ca97f1627ed2d97_tn' },
  { name: 'Đồ Chơi', icon: 'https://cf.shopee.vn/file/ce8f8abc72a54182f1b0715290f64f2f_tn' },
  { name: 'Thể Thao & Du Lịch', icon: 'https://cf.shopee.vn/file/6cb7e633fce2b5e3483f03e997ad6cd5_tn' },
  { name: 'Ô Tô & Xe Máy & Xe Đạp', icon: 'https://cf.shopee.vn/file/3fb459e3449905545701bbf8e8d773f0_tn' },
  { name: 'Bách Hóa Online', icon: 'https://cf.shopee.vn/file/c43214486650f139ad3f629e843027df_tn' },
  { name: 'Nhà Sách & Văn Phòng Phẩm', icon: 'https://cf.shopee.vn/file/364885a71a55900803f0518ce31253e5_tn' },
  { name: 'Thú Cưng', icon: 'https://cf.shopee.vn/file/cd8e0adab8761ee74f3f01ba5fa24f75_tn' },
  { name: 'Nhạc Cụ', icon: 'https://cf.shopee.vn/file/653613734c410972381e4610f973d0fa_tn' },
  { name: 'Voucher & Dịch Vụ', icon: 'https://cf.shopee.vn/file/b0f7f7440a434139b44a883f4ced1ff2_tn' },
  { name: 'Giặt Giũ & Chăm Sóc Nhà Cửa', icon: 'https://cf.shopee.vn/file/cd8e0adab8761ee74f3f01ba5fa24f75_tn' },
  { name: 'Đồ Gia Dụng', icon: 'https://cf.shopee.vn/file/7ab13f8511fad7a2d30ce035d772d4d0_tn' },
  { name: 'Gaming & Console', icon: 'https://cf.shopee.vn/file/978b9e4cb61c611aa25da220b9695fed_tn' },
  { name: 'Âm Thanh', icon: 'https://cf.shopee.vn/file/978b9e4cb61c611aa25da220b9695fed_tn' },
  { name: 'Thiết Bị Mạng', icon: 'https://cf.shopee.vn/file/c3f3675aada2409e741a31246285966f_tn' },
  { name: 'Linh Kiện Máy Tính', icon: 'https://cf.shopee.vn/file/c3f3675aada2409e741a31246285966f_tn' },
  { name: 'Thiết Bị Lưu Trữ', icon: 'https://cf.shopee.vn/file/c3f3675aada2409e741a31246285966f_tn' },
  { name: 'Quà Tặng', icon: 'https://cf.shopee.vn/file/b0f7f7440a434139b44a883f4ced1ff2_tn' },
  { name: 'Đồ Lót & Đồ Ngủ', icon: 'https://cf.shopee.vn/file/687f3967cb7890a9c0fd951240d393b5_tn' },
  { name: 'Phụ Kiện Thời Trang', icon: 'https://cf.shopee.vn/file/8e712455d659de748aba0a8b5fd41cb0_tn' },
  { name: 'Thời Trang Trẻ Em', icon: 'https://cf.shopee.vn/file/099edde1ad31db359ca97f1627ed2d97_tn' },
];

export const CATEGORIES = ['Tất cả', ...CATEGORIES_WITH_ICONS.map(c => c.name)];

export const formatPrice = (price: string | number) => {
  if (!price) return '';
  // Convert to string and remove non-numeric characters
  const numericPrice = price.toString().replace(/\D/g, '');
  if (!numericPrice) return price.toString();
  
  // Format with dots every 3 digits
  return new Intl.NumberFormat('vi-VN').format(parseInt(numericPrice));
};

export const formatDiscount = (discount: string | undefined, originalPrice?: string, discountPrice?: string) => {
  if (discount && discount.trim()) {
    let val = discount.trim();
    // Remove any existing " Giảm" or "%" for standardization
    val = val.replace(/%|Giảm/gi, '').trim();
    if (!val.startsWith('-')) val = '-' + val;
    return `${val}% Giảm`;
  }
  
  // Calculate if missing
  if (originalPrice && discountPrice) {
    const orig = parseInt(originalPrice.replace(/\D/g, ''));
    const disc = parseInt(discountPrice.replace(/\D/g, ''));
    if (orig && disc && orig > disc) {
      const percent = Math.round(((orig - disc) / orig) * 100);
      return `-${percent}% Giảm`;
    }
  }
  
  return null;
};

export const formatSoldCount = (count: string | undefined, prefix: string = 'Đã bán ') => {
  if (!count || !count.trim()) return null;
  return `${prefix}${count.trim()}`;
};

export const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Tai nghe Bluetooth Sony WH-1000XM5",
    image: "https://picsum.photos/seed/sony/400/400",
    originalPrice: "8.990.000đ",
    discountPrice: "6.490.000đ",
    category: "Điện tử",
    badge: "Giảm sâu",
    affiliateUrl: "https://shopee.vn"
  },
  {
    id: 2,
    name: "Áo Khoác Nam Bomber Cao Cấp",
    image: "https://picsum.photos/seed/bomber/400/400",
    originalPrice: "550.000đ",
    discountPrice: "299.000đ",
    category: "Thời trang",
    badge: "Bán chạy",
    affiliateUrl: "https://shopee.vn"
  },
  {
    id: 3,
    name: "Nồi Chiên Không Dầu Philips 5L",
    image: "https://picsum.photos/seed/philips/400/400",
    originalPrice: "4.200.000đ",
    discountPrice: "2.150.000đ",
    category: "Gia dụng",
    badge: "Deal hot",
    affiliateUrl: "https://shopee.vn"
  },
  {
    id: 4,
    name: "Serum Estee Lauder Advanced Night Repair",
    image: "https://picsum.photos/seed/serum/400/400",
    originalPrice: "3.500.000đ",
    discountPrice: "2.450.000đ",
    category: "Làm đẹp",
    badge: "Bán chạy",
    affiliateUrl: "https://shopee.vn"
  },
  {
    id: 5,
    name: "Chuột Không Dây Logitech MX Master 3S",
    image: "https://picsum.photos/seed/logitech/400/400",
    originalPrice: "2.490.000đ",
    discountPrice: "1.890.000đ",
    category: "Điện tử",
    badge: "Deal hot",
    affiliateUrl: "https://shopee.vn"
  },
  {
    id: 6,
    name: "Giày Sneaker Unisex Kiểu Dáng Hàn Quốc",
    image: "https://picsum.photos/seed/sneaker/400/400",
    originalPrice: "890.000đ",
    discountPrice: "450.000đ",
    category: "Thời trang",
    badge: "Giảm sâu",
    affiliateUrl: "https://shopee.vn"
  },
  {
    id: 7,
    name: "Máy Pha Cà Phê Espresso Mini",
    image: "https://picsum.photos/seed/coffee/400/400",
    originalPrice: "1.500.000đ",
    discountPrice: "990.000đ",
    category: "Gia dụng",
    badge: "Deal hot",
    affiliateUrl: "https://shopee.vn"
  },
  {
    id: 8,
    name: "Son Kem Lì Black Rouge Air Fit Velvet",
    image: "https://picsum.photos/seed/lipstick/400/400",
    originalPrice: "250.000đ",
    discountPrice: "145.000đ",
    category: "Làm đẹp",
    badge: "Bán chạy",
    affiliateUrl: "https://shopee.vn"
  },
  {
    id: 9,
    name: "Bàn Phím Cơ Không Dây Keychron K2",
    image: "https://picsum.photos/seed/keyboard/400/400",
    originalPrice: "1.990.000đ",
    discountPrice: "1.550.000đ",
    category: "Điện tử",
    badge: "Giảm sâu",
    affiliateUrl: "https://shopee.vn"
  }
];
