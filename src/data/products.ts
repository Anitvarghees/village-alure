export interface ProductVariant {
  colorName: string;
  hex: string;
  images: string[];
}

export interface CartItem {
  id: string;
  colorIndex: number;
  qty: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  fabric: string;
  price: number;
  mrp?: number;
  description: string;
  details: string[];
  care: string[];
  shippingReturns?: string;
  variants: ProductVariant[];
  featured?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  inStock?: boolean;
  quantity?: number;
}

const publicImages = [
  '/images/IMG_9630.PNG',
  '/images/IMG_9588.PNG',
  '/images/IMG_9587.PNG',
  '/images/IMG_8835.PNG',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2004_19_32%20PM.png',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2004_09_29%20PM.png',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2004_08_42%20PM.png',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2004_08_05%20PM.png',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2004_08_00%20PM.png',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2004_07_15%20PM.png',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2004_06_25%20PM.png',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2004_05_20%20PM.png',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2004_02_42%20PM.png',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2003_52_09%20PM.png',
  '/images/ChatGPT%20Image%20Aug%2022%2C%202026%20at%2003_50_46%20PM.png',
];

export const products: Product[] = [];

const sareeImages = publicImages;
const jewelleryImages = publicImages;
const bagImages = publicImages;
const suitImages = publicImages;

const imgPool = (pool: string[], seed: string, _w = 900, _h = 1150) => {
  const index = Math.abs(seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % pool.length;
  const src = pool[index];
  return src.startsWith('/images/') ? src : `${src}?w=${_w}&h=${_h}&fit=crop`;
};

export const categories = Array.from(new Set(products.map((p) => p.category)));

export interface Collection {
  category: string;
  title: string;
  tagline: string;
  image: string;
}

export const collections: Collection[] = [
  { category: 'Sarees', title: 'Sarees', tagline: 'Kanjivaram, Banarasi & organza — six yards for every moment', image: imgPool(sareeImages, 'coll-silk', 700, 850) },
  { category: 'Jewellery', title: 'Jewellery', tagline: 'Temple kemp, kundan & antique gold', image: imgPool(jewelleryImages, 'coll-ornaments', 700, 850) },
  { category: 'Bags', title: 'Bags', tagline: 'Handwoven clutches, potlis & totes', image: imgPool(bagImages, 'coll-bags', 700, 850) },
  { category: 'Suits Sets', title: 'Suit Sets', tagline: 'Anarkali & straight sets in handloom', image: imgPool(suitImages, 'coll-suits', 700, 850) },
  { category: 'Others', title: 'Others', tagline: 'Curated handloom finds', image: imgPool(publicImages, 'coll-others', 700, 850) },
  { category: 'Gallery', title: 'Gallery', tagline: 'Woven with love', image: imgPool(publicImages, 'coll-gallery', 700, 850) },
];

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const getQuantity = (product: Product | null | undefined): number => {
  const qty = Number((product as any)?.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
};

export const isOutOfStock = (product: Product | null | undefined): boolean => {
  if (!product) return false;
  if (product.inStock === false) return true;
  return getQuantity(product) <= 0;
};
