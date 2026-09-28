import type { Product } from '../data/products';
import { writeUser, clearUser } from './auth';

export const API_BASE = (import.meta as unknown as { env: { DEV: boolean; VITE_API_BASE?: string } }).env.DEV ? '/api' : ((import.meta as unknown as { env: { VITE_API_BASE?: string } }).env.VITE_API_BASE || 'https://api.villageallure.com/api');
export const API_ORIGIN = API_BASE.startsWith('/') ? '' : API_BASE.replace(/\/api\/?$/, '');
export const resolveUploadUrl = (url: string) => {
  if (!url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/images/') || url.startsWith('images/')) return url;
  if (url.startsWith('/api/upload') || url.startsWith('/uploads/') || url.startsWith('uploads/')) {
    const p = url.startsWith('/') ? url : `/${url}`;
    return API_ORIGIN ? `${API_ORIGIN}${p}` : p;
  }
  if (url.startsWith('/')) return API_ORIGIN ? `${API_ORIGIN}${url}` : url;
  return API_ORIGIN ? `${API_ORIGIN}/${url}` : `/${url}`;
};

const getToken = () => localStorage.getItem('reshamAdminToken');

const headers = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
    throw new Error(error.error || `Request failed (${res.status})`);
  }
  return res.json();
};

export interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories: string[];
  image: string;
  description: string;
  linkUrl: string;
  active: boolean;
  order: number;
  createdAt: string;
}

export interface Ad {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  type: 'fixed' | 'carousel';
  position: 'homepage' | 'sidebar' | 'banner';
  offer: string;
  active: boolean;
  order: number;
  createdAt: string;
}

export interface GalleryImage {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  link: string;
  active: boolean;
  order: number;
  createdAt: string;
}

export interface WatchShopItem {
  id: string;
  name: string;
  price: string;
  poster: string;
  video: string;
  productId: string;
  active: boolean;
  order: number;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  category: string;
  rating: number;
  quote: string;
  image: string;
  active: boolean;
  order: number;
  createdAt: string;
}

export interface OrderTracking {
  status: string;
  timestamp: string;
  message: string;
}

export interface Order {
  id: string;
  orderId: string;
  total: number;
  name: string;
  phone: string;
  email?: string;
  payment: string;
  paymentId?: string;
  date: string;
  items: { id: string; colorIndex: number; qty: number; cancelled?: boolean }[];
  status: 'Pending' | 'Processing' | 'Dispatched' | 'Shipped' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  tracking?: OrderTracking[];
  estimatedDelivery?: string;
  trackingLink?: string;
  deliveredAt?: string;
  returnDeadline?: string;
  lastUpdated?: string;
  notes?: string;
}

export interface Review {
  id: string;
  orderId: string;
  productId: string;
  phone: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReturnTracking { status: string; message: string; timestamp: string; }
export interface ReturnRequest {
  id: string;
  returnId?: string;
  orderId: string;
  productId: string;
  phone: string;
  reason: string;
  otherReason?: string;
  description: string;
  qty?: number;
  images?: string[];
  video?: string;
  resolution?: string;
  status: string;
  tracking?: ReturnTracking[];
  adminMessage?: string;
  pickup?: { required?: boolean; address?: string; date?: string; status?: string; courier?: string; trackingNo?: string };
  pickupDate?: string;
  deliveryDate?: string;
  returnDeadline?: string;
  createdAt: string;
  updatedAt?: string;
}
export interface ReturnSettings {
  returnWindow: number;
  enabled: boolean;
  replacementEnabled: boolean;
  exchangeEnabled: boolean;
  videoRequired: boolean;
  imagesRequired: boolean;
  maxVideoSizeMB: number;
  maxImageSizeMB: number;
  maxImages: number;
  maxVideos: number;
  nonReturnableCategories: string[];
  returnConditions: string;
  pickupAvailable: boolean;
  restockingFee: number;
  instructions: string;
  reasons: string[];
}
export interface Notification {
  id: string;
  type: 'cancellation' | 'return' | 'order' | 'general';
  title: string;
  message: string;
  orderId: string;
  productId: string;
  phone: string;
  read: boolean;
  createdAt: string;
}

export const api = {
  auth: {
    login: async (username: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await handleResponse(res);
      if (data.token) {
        localStorage.setItem('reshamAdminToken', data.token);
      }
      return data;
    },
    verify: async () => {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: headers(),
      });
      return handleResponse(res);
    },
    logout: () => {
      localStorage.removeItem('reshamAdminToken');
    },
  },

  categories: {
    getAll: async (): Promise<Category[]> => {
      const res = await fetch(`${API_BASE}/categories`);
      return handleResponse(res);
    },
    getOne: async (id: string): Promise<Category> => {
      const res = await fetch(`${API_BASE}/categories/${id}`);
      return handleResponse(res);
    },
    create: async (category: Omit<Category, 'id' | 'createdAt'>) => {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(category),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Partial<Category>) => {
      const res = await fetch(`${API_BASE}/categories/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/categories/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      return handleResponse(res);
    },
    reorder: async (order: { id: string; order: number }[]): Promise<Category[]> => {
      const res = await fetch(`${API_BASE}/categories/reorder`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ order }),
      });
      return handleResponse(res);
    },
  },

  products: {
    getAll: async (): Promise<Product[]> => {
      const res = await fetch(`${API_BASE}/products`);
      return handleResponse(res);
    },
    getOne: async (id: string): Promise<Product> => {
      const res = await fetch(`${API_BASE}/products/${id}`);
      return handleResponse(res);
    },
    create: async (product: Product) => {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(product),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Partial<Product>) => {
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      return handleResponse(res);
    },
  },

  orders: {
    getAll: async (): Promise<Order[]> => {
      const res = await fetch(`${API_BASE}/orders?t=${Date.now()}`, { headers: headers(), cache: 'no-store' as any });
      return handleResponse(res);
    },
    getOne: async (id: string): Promise<Order> => {
      const res = await fetch(`${API_BASE}/orders/${id}`, { headers: headers() });
      return handleResponse(res);
    },
    getByPhone: async (phone: string): Promise<Order[]> => {
      const res = await fetch(`${API_BASE}/orders/user/${phone}?t=${Date.now()}`, { cache: 'no-store' as any });
      return handleResponse(res);
    },
    track: async (orderId: string) => {
      const res = await fetch(`${API_BASE}/orders/track/${orderId}`);
      return handleResponse(res);
    },
    create: async (order: { total: number; name: string; phone: string; email?: string; payment: string; paymentId?: string; items: { id: string; colorIndex: number; qty: number }[]; address?: string; city?: string; state?: string; pincode?: string }) => {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      return handleResponse(res);
    },
    updateStatus: async (id: string, data: { status: string; message?: string; estimatedDelivery?: string; notes?: string; trackingLink?: string }) => {
      const res = await fetch(`${API_BASE}/orders/${id}/status`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    cancel: async (orderId: string, phone: string, reason?: string, productId?: string) => {
      const res = await fetch(`${API_BASE}/orders/cancel/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, reason, productId }),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/orders/${id}`, { method: 'DELETE', headers: headers() });
      return handleResponse(res);
    },
    update: async (id: string, updates: Partial<Order>) => {
      const res = await fetch(`${API_BASE}/orders/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
  },

  reviews: {
    getByOrder: async (orderId: string): Promise<Review[]> => {
      const res = await fetch(`${API_BASE}/reviews/order/${orderId}`);
      return handleResponse(res);
    },
    getByPhone: async (phone: string): Promise<Review[]> => {
      const res = await fetch(`${API_BASE}/reviews/phone/${phone}`);
      return handleResponse(res);
    },
    create: async (review: Omit<Review, 'id' | 'createdAt'>) => {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review),
      });
      return handleResponse(res);
    },
    getAll: async (): Promise<Review[]> => {
      const res = await fetch(`${API_BASE}/reviews`, { headers: headers() });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/reviews/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      return handleResponse(res);
    },
  },

  returns: {
    getByPhone: async (phone: string): Promise<ReturnRequest[]> => {
      const res = await fetch(`${API_BASE}/returns/phone/${phone}`);
      return handleResponse(res);
    },
    create: async (returnReq: any) => {
      const res = await fetch(`${API_BASE}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnReq),
      });
      return handleResponse(res);
    },
    getAll: async (): Promise<ReturnRequest[]> => {
      const res = await fetch(`${API_BASE}/returns`, { headers: headers() });
      return handleResponse(res);
    },
    getEligibility: async (orderId: string, productId: string) => {
      const res = await fetch(`${API_BASE}/returns/eligibility/${orderId}/${productId}`);
      return handleResponse(res);
    },
    cancel: async (id: string, phone: string) => {
      const res = await fetch(`${API_BASE}/returns/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      return handleResponse(res);
    },
    uploadEvidence: async (files: FileList): Promise<string[]> => {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('images', f));
      const res = await fetch(`${API_BASE}/upload/return`, { method: 'POST', body: formData });
      const data = await handleResponse(res);
      return data.urls;
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/returns/${id}`, { method: 'DELETE', headers: headers() });
      return handleResponse(res);
    },
    updateStatus: async (id: string, status: string, extra?: any) => {
      const res = await fetch(`${API_BASE}/returns/${id}/status`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ status, ...extra }),
      });
      return handleResponse(res);
    },
  },

  returnSettings: {
    get: async (): Promise<ReturnSettings> => {
      const res = await fetch(`${API_BASE}/return-settings`);
      return handleResponse(res);
    },
    getAdmin: async (): Promise<ReturnSettings> => {
      const res = await fetch(`${API_BASE}/return-settings/admin`, { headers: headers() });
      return handleResponse(res);
    },
    update: async (data: Partial<ReturnSettings>) => {
      const res = await fetch(`${API_BASE}/return-settings`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) });
      return handleResponse(res);
    },
  },

  ads: {
    getAll: async (): Promise<Ad[]> => {
      const res = await fetch(`${API_BASE}/ads`, { headers: headers() });
      return handleResponse(res);
    },
    getActive: async (): Promise<Ad[]> => {
      const res = await fetch(`${API_BASE}/ads/active`);
      return handleResponse(res);
    },
    getActiveByType: async (type: string): Promise<Ad[]> => {
      const res = await fetch(`${API_BASE}/ads/active/${type}`);
      return handleResponse(res);
    },
    create: async (ad: Omit<Ad, 'id' | 'createdAt'>) => {
      const res = await fetch(`${API_BASE}/ads`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(ad),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Partial<Ad>) => {
      const res = await fetch(`${API_BASE}/ads/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/ads/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      return handleResponse(res);
    },
  },

  dashboard: {
    getStats: async () => {
      const res = await fetch(`${API_BASE}/dashboard/stats`, { headers: headers() });
      return handleResponse(res);
    },
    getSales: async (category?: string) => {
      const url = category ? `${API_BASE}/dashboard/sales?category=${category}` : `${API_BASE}/dashboard/sales`;
      const res = await fetch(url, { headers: headers() });
      return handleResponse(res);
    },
  },

  upload: {
    images: async (files: FileList): Promise<string[]> => {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('images', file);
      });
      const token = getToken();
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await handleResponse(res);
      return data.urls;
    },
  },

  gallery: {
    getAll: async (): Promise<GalleryImage[]> => {
      const res = await fetch(`${API_BASE}/gallery`, { headers: headers() });
      return handleResponse(res);
    },
    getActive: async (): Promise<GalleryImage[]> => {
      const res = await fetch(`${API_BASE}/gallery/active`);
      return handleResponse(res);
    },
    create: async (image: Omit<GalleryImage, 'id' | 'createdAt'>) => {
      const res = await fetch(`${API_BASE}/gallery`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(image),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Partial<GalleryImage>) => {
      const res = await fetch(`${API_BASE}/gallery/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/gallery/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      return handleResponse(res);
    },
  },

  watchshop: {
    getAll: async (): Promise<WatchShopItem[]> => {
      const res = await fetch(`${API_BASE}/watchshop`, { headers: headers() });
      return handleResponse(res);
    },
    getActive: async (): Promise<WatchShopItem[]> => {
      const res = await fetch(`${API_BASE}/watchshop/active`);
      return handleResponse(res);
    },
    create: async (item: Omit<WatchShopItem, 'id' | 'createdAt'>) => {
      const res = await fetch(`${API_BASE}/watchshop`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(item),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Partial<WatchShopItem>) => {
      const res = await fetch(`${API_BASE}/watchshop/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/watchshop/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      return handleResponse(res);
    },
  },

  testimonials: {
    getAll: async (): Promise<Testimonial[]> => {
      const res = await fetch(`${API_BASE}/testimonials`, { headers: headers() });
      return handleResponse(res);
    },
    getActive: async (): Promise<Testimonial[]> => {
      const res = await fetch(`${API_BASE}/testimonials/active`);
      return handleResponse(res);
    },
    create: async (item: Omit<Testimonial, 'id' | 'createdAt'>) => {
      const res = await fetch(`${API_BASE}/testimonials`, { method: 'POST', headers: headers(), body: JSON.stringify(item) });
      return handleResponse(res);
    },
    update: async (id: string, updates: Partial<Testimonial>) => {
      const res = await fetch(`${API_BASE}/testimonials/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(updates) });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/testimonials/${id}`, { method: 'DELETE', headers: headers() });
      return handleResponse(res);
    },
  },

  weaverStory: {
    get: async () => {
      const res = await fetch(`${API_BASE}/weaver-story`);
      return handleResponse(res);
    },
    update: async (data: any) => {
      const res = await fetch(`${API_BASE}/weaver-story`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) });
      return handleResponse(res);
    },
  },

  curatedEdits: {
    getAll: async () => {
      const res = await fetch(`${API_BASE}/curated-edits/all`, { headers: headers() });
      const data = await res.json().catch(() => []);
      if (res.ok) return data;
      const r2 = await fetch(`${API_BASE}/curated-edits/active`);
      return handleResponse(r2);
    },
    getActive: async () => {
      const res = await fetch(`${API_BASE}/curated-edits/active`);
      return handleResponse(res);
    },
    create: async (item: any) => {
      const res = await fetch(`${API_BASE}/curated-edits`, { method: 'POST', headers: headers(), body: JSON.stringify(item) });
      return handleResponse(res);
    },
    update: async (id: string, updates: any) => {
      const res = await fetch(`${API_BASE}/curated-edits/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(updates) });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/curated-edits/${id}`, { method: 'DELETE', headers: headers() });
      return handleResponse(res);
    },
  },

  heroSlides: {
    getAll: async () => {
      const res = await fetch(`${API_BASE}/hero-slides/all`, { headers: headers() });
      const data = await res.json().catch(() => []);
      if (res.ok) return data;
      const r2 = await fetch(`${API_BASE}/hero-slides/active`);
      return handleResponse(r2);
    },
    getActive: async () => {
      const res = await fetch(`${API_BASE}/hero-slides/active`);
      return handleResponse(res);
    },
    create: async (item: any) => {
      const res = await fetch(`${API_BASE}/hero-slides`, { method: 'POST', headers: headers(), body: JSON.stringify(item) });
      return handleResponse(res);
    },
    update: async (id: string, updates: any) => {
      const res = await fetch(`${API_BASE}/hero-slides/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(updates) });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/hero-slides/${id}`, { method: 'DELETE', headers: headers() });
      return handleResponse(res);
    },
  },

  instagram: {
    getAll: async () => {
      const res = await fetch(`${API_BASE}/instagram`, { headers: headers() });
      return handleResponse(res);
    },
    getActive: async () => {
      const res = await fetch(`${API_BASE}/instagram/active`);
      return handleResponse(res);
    },
    create: async (item: any) => {
      const res = await fetch(`${API_BASE}/instagram`, { method: 'POST', headers: headers(), body: JSON.stringify(item) });
      return handleResponse(res);
    },
    update: async (id: string, updates: any) => {
      const res = await fetch(`${API_BASE}/instagram/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(updates) });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/instagram/${id}`, { method: 'DELETE', headers: headers() });
      return handleResponse(res);
    },
  },

  notifications: {
    getAll: async (): Promise<Notification[]> => {
      const res = await fetch(`${API_BASE}/notifications`, { headers: headers() });
      return handleResponse(res);
    },
    getUnread: async () => {
      const res = await fetch(`${API_BASE}/notifications/unread`, { headers: headers() });
      return handleResponse(res);
    },
    markAllRead: async () => {
      const res = await fetch(`${API_BASE}/notifications/read-all`, { method: 'PUT', headers: headers() });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/notifications/${id}`, { method: 'DELETE', headers: headers() });
      return handleResponse(res);
    },
  },

  payments: {
    createOrder: async (amount: number, receipt?: string) => {
      const res = await fetch(`${API_BASE}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency: 'INR', receipt }),
      });
      return handleResponse(res);
    },
    verify: async (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
      const res = await fetch(`${API_BASE}/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
  },

  customers: {
    register: async (data: { name: string; email: string; phone?: string; password: string }) => {
      const res = await fetch(`${API_BASE}/customers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await handleResponse(res);
      if (result.token) {
        localStorage.setItem('reshamCustomerToken', result.token);
        writeUser(result.customer, 'login', 'Account created — you are logged in');
      }
      return result;
    },
    login: async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/customers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await handleResponse(res);
      if (result.token) {
        localStorage.setItem('reshamCustomerToken', result.token);
        writeUser(result.customer, 'login', 'Logged in successfully');
      }
      return result;
    },
    logout: () => {
      clearUser('Logged out');
    },
    getProfile: async () => {
      const token = localStorage.getItem('reshamCustomerToken');
      const res = await fetch(`${API_BASE}/customers/profile`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return handleResponse(res);
    },
    getAll: async () => {
      const res = await fetch(`${API_BASE}/customers`, { headers: headers() });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/customers/${id}`, { method: 'DELETE', headers: headers() });
      return handleResponse(res);
    },
  },
};