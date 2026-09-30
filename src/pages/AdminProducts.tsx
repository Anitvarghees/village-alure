import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, resolveUploadUrl } from '../lib/api';
import type { Product } from '../data/products';
import { isOutOfStock, getQuantity } from '../data/products';
import type { Category } from '../lib/api';

interface Variant {
  colorName: string;
  hex: string;
  images: string[];
}

const emptyVariant: Variant = { colorName: '', hex: '', images: [] };

const emptyProduct: Product = {
  id: '',
  name: '',
  category: 'Sarees',
  subCategory: '',
  fabric: '',
  price: 0,
  mrp: 0,
  description: '',
  details: [],
  care: [],
  shippingReturns: '',
  variants: [],
  featured: false,
  isNew: false,
  isBestSeller: false,
  inStock: false,
  quantity: 0,
  returnable: true,
  returnWindow: 7,
  replacementAvailable: true,
  exchangeAvailable: false,
  unboxingVideoRequired: false,
  nonReturnableReason: '',
} as any;

const presetColors = [
  { name: 'Deep Maroon', hex: '#6b1e23' },
  { name: 'Burgundy', hex: '#722f37' },
  { name: 'Wine Red', hex: '#722f37' },
  { name: 'Crimson', hex: '#dc143c' },
  { name: 'Ruby Red', hex: '#9b111e' },
  { name: 'Brick Red', hex: '#cb4154' },
  { name: 'Rose Pink', hex: '#ff007f' },
  { name: 'Dusty Rose', hex: '#dcae96' },
  { name: 'Blush Pink', hex: '#de5d83' },
  { name: 'Baby Pink', hex: '#f4c2c2' },
  { name: 'Coral', hex: '#ff7f50' },
  { name: 'Salmon', hex: '#fa8072' },
  { name: 'Peach', hex: '#ffcba4' },
  { name: 'Apricot', hex: '#fbceb1' },
  { name: 'Burnt Orange', hex: '#cc5500' },
  { name: 'Rust', hex: '#b7410e' },
  { name: 'Terracotta', hex: '#e2725b' },
  { name: 'Amber', hex: '#ffbf00' },
  { name: 'Mustard', hex: '#ffdb58' },
  { name: 'Golden Yellow', hex: '#ffd700' },
  { name: 'Antique Gold', hex: '#c9a96e' },
  { name: 'Dark Gold', hex: '#b8860b' },
  { name: 'Champagne', hex: '#f7e7ce' },
  { name: 'Ivory', hex: '#fffff0' },
  { name: 'Cream', hex: '#fffdd0' },
  { name: 'Lemon', hex: '#fff44f' },
  { name: 'Lime Green', hex: '#32cd32' },
  { name: 'Olive Green', hex: '#808000' },
  { name: 'Moss Green', hex: '#8a9a5b' },
  { name: 'Sage Green', hex: '#9cad8f' },
  { name: 'Emerald', hex: '#50c878' },
  { name: 'Teal', hex: '#008080' },
  { name: 'Emerald Teal', hex: '#1f4741' },
  { name: 'Sea Green', hex: '#2e8b57' },
  { name: 'Mint', hex: '#98ff98' },
  { name: 'Aqua', hex: '#00ffff' },
  { name: 'Turquoise', hex: '#40e0d0' },
  { name: 'Sky Blue', hex: '#87ceeb' },
  { name: 'Powder Blue', hex: '#b0e0e6' },
  { name: 'Baby Blue', hex: '#89cff0' },
  { name: 'Royal Blue', hex: '#4169e1' },
  { name: 'Navy Blue', hex: '#000080' },
  { name: 'Indigo', hex: '#4b0082' },
  { name: 'Cobalt', hex: '#0047ab' },
  { name: 'Sapphire', hex: '#0f52ba' },
  { name: 'Lavender', hex: '#e6e6fa' },
  { name: 'Lilac', hex: '#c8a2c8' },
  { name: 'Royal Purple', hex: '#7851a9' },
  { name: 'Plum', hex: '#8e4585' },
  { name: 'Mauve', hex: '#e0b0ff' },
  { name: 'Violet', hex: '#8f00ff' },
  { name: 'Grape', hex: '#6f2da8' },
  { name: 'Black', hex: '#000000' },
  { name: 'Charcoal', hex: '#36454f' },
  { name: 'Slate Gray', hex: '#708090' },
  { name: 'Silver', hex: '#c0c0c0' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Snow White', hex: '#fffafa' },
  { name: 'Beige', hex: '#f5f5dc' },
  { name: 'Tan', hex: '#d2b48c' },
  { name: 'Khaki', hex: '#c3b091' },
  { name: 'Brown', hex: '#964b00' },
  { name: 'Chocolate', hex: '#7b3f00' },
  { name: 'Coffee', hex: '#6f4e37' },
  { name: 'Copper', hex: '#b87333' },
  { name: 'Bronze', hex: '#cd7f32' },
  { name: 'Rose Gold', hex: '#b76e79' },
];

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Product>(emptyProduct);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeVariantTab, setActiveVariantTab] = useState(0);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        api.products.getAll(),
        api.categories.getAll(),
      ]);
      const sorted = [...productsData].sort((a: any, b: any) => {
        const at = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const bt = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        return bt - at;
      });
      setProducts(sorted);
      setCategories(categoriesData.filter((c) => c.active));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categoryNames = ['All', ...categories.map((c) => c.name)];
  const subcategoriesForCategory = categories.find((c) => c.name === form.category)?.subcategories || [];

  const filtered = [...products].filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a: any, b: any) => {
    const at = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
    const bt = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
    return bt - at;
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyProduct, id: `product-${Date.now()}` });
    setActiveVariantTab(0);
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    const qty = Math.max(0, Number((product as any).quantity ?? 0));
    setEditing(product);
    setForm({ ...product, quantity: qty, inStock: qty > 0 ? product.inStock !== false : false } as Product);
    setActiveVariantTab(0);
    setShowModal(true);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Product name is required';
    if (!form.price || form.price <= 0) newErrors.price = 'Valid selling price is required';
    if (!form.category) newErrors.category = 'Category is required';
    if (form.variants.length === 0) {
      newErrors.variants = 'At least one variant with images is required';
    } else {
      form.variants.forEach((v, i) => {
        if (!v.images || v.images.length === 0) {
          newErrors[`variantImages_${i}`] = `At least one image is required for Variant ${i + 1}`;
        }
      });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const qty = Math.max(0, Math.floor(Number((form as any).quantity ?? 0)) || 0);
    const payload = {
      ...form,
      quantity: qty,
      inStock: qty > 0 ? form.inStock !== false : false,
    } as Product;
    try {
      if (editing) {
        const updated: any = await api.products.update(editing.id, payload);
        setProducts((prev) => {
          const rest = prev.filter((p) => p.id !== editing.id);
          const merged = updated?.id ? updated : { ...payload, createdAt: new Date().toISOString() } as any;
          return [merged, ...rest];
        });
      } else {
        const created: any = await api.products.create(payload);
        const newProd: any = created?.id ? created : { ...payload, createdAt: new Date().toISOString() };
        setProducts((prev) => [newProd, ...prev.filter((p) => p.id !== newProd.id)]);
        setSearch('');
        setCategoryFilter('All');
      }
      setForm(payload);
      setErrors({});
      setShowModal(false);
      await loadData();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Failed to save product:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.products.delete(id);
      await loadData();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const handleStockToggle = async (product: Product) => {
    const qty = Math.max(0, Number((product as any).quantity ?? 0));
    const nextInStock = product.inStock === false;
    if (nextInStock && qty <= 0) return;
    try {
      await api.products.update(product.id, { ...product, quantity: qty, inStock: qty > 0 ? nextInStock : false });
      await loadData();
    } catch (error) {
      console.error('Failed to toggle stock:', error);
    }
  };

  const updateForm = (key: string, value: unknown) => {
    setForm((f) => {
      const next = { ...f, [key]: value } as Product;
      if (key === 'quantity') {
        const prevQty = Math.max(0, Number((f as any).quantity ?? 0));
        const qty = Math.max(0, Number(value ?? 0));
        next.quantity = qty;
        if (qty <= 0) next.inStock = false;
        else if (prevQty <= 0) next.inStock = true;
      }
      return next;
    });
  };

  const updateVariant = (index: number, key: keyof Variant, value: unknown) => {
    setForm((f) => {
      const variants = [...f.variants];
      variants[index] = { ...variants[index], [key]: value };
      return { ...f, variants };
    });
  };

  const addVariant = () => {
    setForm((f) => ({
      ...f,
      variants: [...f.variants, { ...emptyVariant }],
    }));
    setActiveVariantTab(form.variants.length);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.variants;
      return next;
    });
  };

  const removeVariant = (index: number) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.filter((_, i) => i !== index),
    }));
    setActiveVariantTab(Math.max(0, Math.min(activeVariantTab, form.variants.length - 2)));
  };

  const handleImageUpload = async (variantIndex: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      const urls = await api.upload.images(files);
      const variants = [...form.variants];
      variants[variantIndex] = {
        ...variants[variantIndex],
        images: [...variants[variantIndex].images, ...urls],
      };
      setForm((f) => ({ ...f, variants }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`variantImages_${variantIndex}`];
        if (form.variants.length > 0) delete next.variants;
        return next;
      });
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (variantIndex: number, imageIndex: number) => {
    const variants = [...form.variants];
    variants[variantIndex] = {
      ...variants[variantIndex],
      images: variants[variantIndex].images.filter((_, i) => i !== imageIndex),
    };
    setForm((f) => ({ ...f, variants }));
  };

  const handleUrlAdd = (variantIndex: number, url: string) => {
    if (!url.trim()) return;
    const variants = [...form.variants];
    variants[variantIndex] = {
      ...variants[variantIndex],
      images: [...variants[variantIndex].images, url.trim()],
    };
    setForm((f) => ({ ...f, variants }));
  };

  const totalProducts = products.length;
  const inStockCount = products.filter((p) => !isOutOfStock(p)).length;
  const outOfStockCount = products.filter((p) => isOutOfStock(p)).length;

  if (loading) {
    return (
      <div className="admin-products-loading">
        <div className="admin-products-spinner" />
        <span>Loading products...</span>
      </div>
    );
  }

  return (
    <div className="admin-products-page">
      <div className="admin-products-stats">
        <div className="admin-products-stat">
          <div className="admin-products-stat-icon-box" style={{ background: 'linear-gradient(135deg, rgba(107,30,35,0.08) 0%, rgba(107,30,35,0.04) 100%)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--maroon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          </div>
          <div className="admin-products-stat-text">
            <span className="admin-products-stat-value">{totalProducts}</span>
            <span className="admin-products-stat-label">Total Products</span>
          </div>
        </div>
        <div className="admin-products-stat green">
          <div className="admin-products-stat-icon-box" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08) 0%, rgba(5,150,105,0.04) 100%)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="admin-products-stat-text">
            <span className="admin-products-stat-value">{inStockCount}</span>
            <span className="admin-products-stat-label">In Stock</span>
          </div>
        </div>
        <div className="admin-products-stat red">
          <div className="admin-products-stat-icon-box" style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(220,38,38,0.04) 100%)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="admin-products-stat-text">
            <span className="admin-products-stat-value">{outOfStockCount}</span>
            <span className="admin-products-stat-label">Out of Stock</span>
          </div>
        </div>
      </div>

      <div className="admin-products-toolbar">
        <div className="admin-products-toolbar-left">
          <div className="admin-products-search-wrap">
            <svg className="admin-products-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-products-search"
            />
            {search && (
              <button className="admin-products-search-clear" onClick={() => setSearch('')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="admin-products-filter">
            {categoryNames.map((c) => (
              <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
            ))}
          </select>
        </div>
        <button onClick={openAdd} className="admin-products-add-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Product
        </button>
      </div>

      <div className="admin-card" style={{ overflow: 'hidden' }}>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '38%' }}>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th style={{ width: '14%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className={isOutOfStock(product) ? 'admin-row-outofstock' : ''}>
                  <td>
                    <div className="admin-product-cell">
                      <div className="admin-product-thumb-wrap">
                        <img onError={(e)=>{const t=e.target as HTMLImageElement; if(!t.dataset.fallback){t.dataset.fallback='1'; t.style.display='none';}}} width={400} height={400} loading="lazy" decoding="async"
                          src={resolveUploadUrl(product.variants[0]?.images[0]) || 'https://via.placeholder.com/56x70?text=No+Img'}
                          alt={product.name}
                          className="admin-product-thumb"
                        />
                        {product.variants.length > 1 && (
                          <span className="admin-product-variant-badge">{product.variants.length}</span>
                        )}
                      </div>
                      <div className="admin-product-info">
                        <span className="admin-product-name">{product.name}</span>
                        <span className="admin-product-id">{product.id}</span>
                        <div className="admin-product-colors">
                          {product.variants.slice(0, 6).map((v, i) => (
                            <span key={i} title={v.colorName} className="admin-color-dot" style={{ background: v.hex }} />
                          ))}
                          {product.variants.length > 6 && (
                            <span className="admin-color-more">+{product.variants.length - 6}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="admin-category-label">{product.category}</span>
                    {product.subCategory && <span className="admin-subcategory-label">{product.subCategory}</span>}
                    {product.fabric && <span className="admin-fabric-label">{product.fabric}</span>}
                  </td>
                  <td>
                    <div className="admin-price-main">₹{product.price.toLocaleString('en-IN')}</div>
                    {product.mrp && product.mrp > product.price && (
                      <div className="admin-price-mrp">
                        <span className="admin-price-original">₹{product.mrp.toLocaleString('en-IN')}</span>
                        <span className="admin-price-discount">{Math.round(((product.mrp - product.price) / product.mrp) * 100)}% off</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => handleStockToggle(product)}
                      disabled={getQuantity(product) <= 0}
                      title={getQuantity(product) <= 0 ? 'Add quantity to mark this product in stock' : undefined}
                      className={`admin-stock-toggle ${isOutOfStock(product) ? 'out-of-stock' : 'in-stock'}`}
                      style={getQuantity(product) <= 0 ? { cursor: 'not-allowed', opacity: 0.75 } : undefined}
                    >
                      <span className="admin-stock-dot" />
                      {isOutOfStock(product) ? 'Out of Stock' : 'In Stock'}
                    </button>
                    <div style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: 4 }}>
                      Qty: {getQuantity(product)}
                      {getQuantity(product) > 0 && getQuantity(product) <= 2 && (
                        <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: 4 }}>Low</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="admin-actions-cell">
                      <button
                        onClick={() => setDetailProduct(product)}
                        className="admin-action-btn view"
                        title="View product"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      <button
                        onClick={() => openEdit(product)}
                        className="admin-action-btn edit"
                        title="Edit product"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {deleteConfirm === product.id ? (
                        <div className="admin-delete-confirm">
                          <button onClick={() => handleDelete(product.id)} className="admin-action-btn confirm-delete" title="Confirm delete">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="admin-action-btn cancel-delete" title="Cancel">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(product.id)}
                          className="admin-action-btn delete"
                          title="Delete product"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--ink-soft)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 12 }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No products found</div>
                    <div style={{ fontSize: '0.82rem', marginTop: 6, opacity: 0.7 }}>{search ? 'Try a different search term' : 'Start by adding your first product'}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {detailProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="admin-modal-overlay" onClick={() => setDetailProduct(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} className="admin-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>{detailProduct.name}</h3>
                <button onClick={() => setDetailProduct(null)} className="admin-modal-close">✕</button>
              </div>
              <div className="admin-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {detailProduct.variants.flatMap((v) => v.images).slice(0, 6).map((img, i) => (
                        <img onError={(e)=>{const t=e.target as HTMLImageElement; if(!t.dataset.fallback){t.dataset.fallback='1'; t.style.display='none';}}} width={400} height={400} loading="lazy" decoding="async" key={i} src={resolveUploadUrl(img)} alt="Village Allure image" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} />
                      ))}
                      {detailProduct.variants.flatMap((v) => v.images).length === 0 && <div style={{ gridColumn: '1 / -1', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ivory-deep)', borderRadius: 12, color: 'var(--ink-soft)', border: '1px dashed var(--line)' }}>No images</div>}
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {detailProduct.variants.map((v, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.35rem 0.6rem', borderRadius: 20, border: '1px solid var(--line)', fontSize: '0.72rem', background: 'var(--ivory-deep)' }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: v.hex, border: '1px solid rgba(0,0,0,0.1)' }} />
                          {v.colorName} • {v.images.length} img
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div><span style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>ID</span><div style={{ fontSize: '0.82rem', color: 'var(--ink)' }}>{detailProduct.id}</div></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div><span style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>Category</span><div style={{ fontSize: '0.85rem' }}>{detailProduct.category}{detailProduct.subCategory ? ` • ${detailProduct.subCategory}` : ''}</div></div>
                        <div><span style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>Fabric</span><div style={{ fontSize: '0.85rem' }}>{detailProduct.fabric || '—'}</div></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div><span style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>Price</span><div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--maroon)' }}>₹{detailProduct.price.toLocaleString('en-IN')}{detailProduct.mrp ? <span style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', fontWeight: 400, textDecoration: 'line-through', marginLeft: 8 }}>₹{detailProduct.mrp.toLocaleString('en-IN')}</span> : null}</div></div>
                        <div><span style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>Stock</span><div><span className={`admin-status-badge ${isOutOfStock(detailProduct) ? 'cancelled' : 'delivered'}`} style={{ marginTop: 4 }}>{isOutOfStock(detailProduct) ? 'Out of Stock' : 'In Stock'}</span></div></div>
                        <div><span style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>Quantity</span><div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{getQuantity(detailProduct)} pieces{isOutOfStock(detailProduct) ? <span style={{ color: '#dc2626', marginLeft: 6, fontSize: '0.78rem' }}>Out of stock</span> : getQuantity(detailProduct) <= 2 && <span style={{ color: '#dc2626', marginLeft: 6, fontSize: '0.78rem' }}>Low stock</span>}</div></div>
                      </div>
                      <div><span style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>Description</span><div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: 1.6, marginTop: 4 }}>{detailProduct.description || 'No description'}</div></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button onClick={() => setDetailProduct(null)} className="admin-btn admin-btn-outline">Close</button>
                <button onClick={() => { const p = detailProduct; setDetailProduct(null); if (p) openEdit(p); }} className="admin-btn admin-btn-primary">Edit Product</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="admin-modal-overlay"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="admin-modal admin-modal-wide"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-modal-header">
                <h3>{editing ? 'Edit Product' : 'Add New Product'}</h3>
                <button onClick={() => setShowModal(false)} className="admin-modal-close">✕</button>
              </div>

              <div className="admin-modal-body">
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Product Name *</label>
                    <input value={form.name} onChange={(e) => { updateForm('name', e.target.value); setErrors((prev) => ({ ...prev, name: '' })); }} placeholder="e.g. Kanjivaram Silk Saree" className={errors.name ? 'admin-input-error' : ''} />
                    {errors.name && <span className="admin-field-error">{errors.name}</span>}
                  </div>
                  <div className="admin-form-group">
                    <label>Product ID</label>
                    <input value={form.id} onChange={(e) => updateForm('id', e.target.value)} disabled={!!editing} />
                  </div>
                </div>

                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Category *</label>
                    <select
                      value={form.category}
                      onChange={(e) => {
                        updateForm('category', e.target.value);
                        updateForm('subCategory', '');
                        setErrors((prev) => ({ ...prev, category: '' }));
                      }}
                      className={errors.category ? 'admin-input-error' : ''}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    {errors.category && <span className="admin-field-error">{errors.category}</span>}
                  </div>
                  <div className="admin-form-group">
                    <label>Sub Category</label>
                    {subcategoriesForCategory.length > 0 ? (
                      <select value={form.subCategory || ''} onChange={(e) => updateForm('subCategory', e.target.value)}>
                        <option value="">Select subcategory</option>
                        {subcategoriesForCategory.map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    ) : (
                      <input value={form.subCategory || ''} onChange={(e) => updateForm('subCategory', e.target.value)} placeholder="e.g. Chanderi Silk" />
                    )}
                  </div>
                </div>

                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Fabric</label>
                    <input value={form.fabric} onChange={(e) => updateForm('fabric', e.target.value)} placeholder="e.g. Pure Mulberry Silk" />
                  </div>
                  <div className="admin-form-group">
                    <label>Selling Price (₹) *</label>
                    <input type="number" value={form.price || ''} onChange={(e) => { updateForm('price', Number(e.target.value)); setErrors((prev) => ({ ...prev, price: '' })); }} className={errors.price ? 'admin-input-error' : ''} />
                    {errors.price && <span className="admin-field-error">{errors.price}</span>}
                  </div>
                </div>

                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>MRP (₹)</label>
                    <input type="number" value={form.mrp || ''} onChange={(e) => updateForm('mrp', Number(e.target.value))} />
                  </div>
                  <div className="admin-form-group">
                    <label>Status</label>
                    <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!form.isNew} onChange={(e) => updateForm('isNew', e.target.checked)} />
                        New Arrival
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!form.isBestSeller} onChange={(e) => updateForm('isBestSeller', e.target.checked)} />
                        Best Seller
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!form.featured} onChange={(e) => updateForm('featured', e.target.checked)} />
                        Featured
                      </label>
                    </div>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Stock Availability</label>
                    <div className="admin-form-stock-toggle">
                      <button
                        type="button"
                        disabled={Number((form as any).quantity ?? 0) <= 0}
                        title={Number((form as any).quantity ?? 0) <= 0 ? 'Add quantity first' : undefined}
                        className={`admin-stock-btn ${form.inStock !== false && Number((form as any).quantity ?? 0) > 0 ? 'active' : ''}`}
                        onClick={() => updateForm('inStock', true)}
                      >
                        <span className="admin-stock-btn-dot in" />
                        In Stock
                      </button>
                      <button
                        type="button"
                        className={`admin-stock-btn ${form.inStock === false || Number((form as any).quantity ?? 0) <= 0 ? 'active' : ''}`}
                        onClick={() => updateForm('inStock', false)}
                      >
                        <span className="admin-stock-btn-dot out" />
                        Out of Stock
                      </button>
                    </div>
                    {Number((form as any).quantity ?? 0) <= 0 && (
                      <p style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.4rem' }}>
                        Zero or empty quantity marks this product Out of Stock.
                      </p>
                    )}
                  </div>
                  <div className="admin-form-group">
                    <label>Quantity (Pieces)</label>
                    <input
                      type="number"
                      min={0}
                      value={(form as any).quantity ?? 0}
                      onChange={(e) => updateForm('quantity', Math.max(0, Number(e.target.value)))}
                      placeholder="e.g. 10"
                    />
                  </div>
                </div>

                <div style={{ background:'#fefce8', border:'1px solid #fde68a', borderRadius:10, padding:'1rem', marginBottom:'1rem' }}>
                  <p style={{ fontSize:'0.82rem', fontWeight:700, marginBottom:'0.6rem' }}>↩️ Return Settings (overrides global)</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                    <label style={{ display:'flex', gap:'0.5rem', alignItems:'center', fontSize:'0.82rem' }}><input type="checkbox" checked={(form as any).returnable!==false} onChange={e=>updateForm('returnable', e.target.checked)} /> Returnable</label>
                    <label style={{ fontSize:'0.78rem' }}>Return Window (days)<input type="number" value={(form as any).returnWindow||7} onChange={e=>updateForm('returnWindow', Number(e.target.value))} style={{ width:'100%', padding:'0.4rem', border:'1px solid var(--line)', borderRadius:6, marginTop:'0.2rem' }} /></label>
                  </div>
                  <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginTop:'0.6rem' }}>
                    <label style={{ display:'flex', gap:'0.3rem', alignItems:'center', fontSize:'0.78rem' }}><input type="checkbox" checked={(form as any).replacementAvailable!==false} onChange={e=>updateForm('replacementAvailable', e.target.checked)} /> Replacement</label>
                    <label style={{ display:'flex', gap:'0.3rem', alignItems:'center', fontSize:'0.78rem' }}><input type="checkbox" checked={!!(form as any).exchangeAvailable} onChange={e=>updateForm('exchangeAvailable', e.target.checked)} /> Exchange</label>
                    <label style={{ display:'flex', gap:'0.3rem', alignItems:'center', fontSize:'0.78rem' }}><input type="checkbox" checked={!!(form as any).unboxingVideoRequired} onChange={e=>updateForm('unboxingVideoRequired', e.target.checked)} /> Video Required</label>
                  </div>
                  { (form as any).returnable===false && <input value={(form as any).nonReturnableReason||''} onChange={e=>updateForm('nonReturnableReason', e.target.value)} placeholder="Reason for non-returnable" style={{ width:'100%', padding:'0.4rem', border:'1px solid var(--line)', borderRadius:6, marginTop:'0.6rem', fontSize:'0.82rem' }} />}
                </div>

                <div className="admin-form-group">
                  <label>Description</label>
                  <textarea rows={3} value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="Product description..." />
                </div>

                <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div className="admin-form-group">
                    <label>Piece Details</label>
                    <textarea
                      rows={4}
                      value={form.details.join('\n')}
                      onChange={(e) => updateForm('details', e.target.value.split('\n').filter(Boolean))}
                      placeholder={"One detail per line, e.g.\nLength: 5.5 meters\nBlouse: Running material\nWeight: 600 grams"}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div className="admin-form-group">
                    <label>Fabric & Care</label>
                    <textarea
                      rows={4}
                      value={form.care.join('\n')}
                      onChange={(e) => updateForm('care', e.target.value.split('\n').filter(Boolean))}
                      placeholder={"One care instruction per line, e.g.\nDry clean only\nStore in a cotton bag\nAvoid direct sunlight"}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div className="admin-form-group">
                    <label>Shipping & Returns</label>
                    <textarea
                      rows={3}
                      value={(form as any).shippingReturns || ''}
                      onChange={(e) => updateForm('shippingReturns', e.target.value)}
                      placeholder="e.g. Ships in 3–5 business days. Easy returns within 7 days of delivery."
                    />
                  </div>
                </div>

                <div className="admin-variants-section">
                  <div className="admin-variants-header">
                    <label>Color Variants & Images</label>
                    <button type="button" onClick={addVariant} className="admin-btn admin-btn-sm-outline">
                      + Add Variant
                    </button>
                  </div>
                  {errors.variants && <span className="admin-field-error" style={{ marginBottom: '0.5rem', display: 'block' }}>{errors.variants}</span>}

                  <div className="admin-variant-tabs">
                    {form.variants.length === 0 && (
                      <span className="admin-variant-empty">No variants added yet</span>
                    )}
                    {form.variants.map((v, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`admin-variant-tab ${activeVariantTab === i ? 'active' : ''}`}
                        onClick={() => setActiveVariantTab(i)}
                      >
                        <span
                          className="admin-variant-tab-color"
                          style={{ background: v.hex || '#ccc' }}
                        />
                        <span>{v.colorName || `Variant ${i + 1}`}</span>
                        <span
                          className="admin-variant-tab-remove"
                          onClick={(e) => { e.stopPropagation(); removeVariant(i); }}
                        >
                          ×
                        </span>
                      </button>
                    ))}
                  </div>

                  {form.variants.map((variant, vIndex) => (
                    vIndex === activeVariantTab && (
                      <div key={vIndex} className="admin-variant-content">
                        <div className="admin-form-grid">
                          <div className="admin-form-group">
                            <label>Color Name</label>
                            <input
                              value={variant.colorName}
                              onChange={(e) => updateVariant(vIndex, 'colorName', e.target.value)}
                              placeholder="e.g. Deep Maroon"
                            />
                          </div>
                          <div className="admin-form-group">
                            <label>Color</label>
                            <div className="admin-color-picker-wrap">
                              <input
                                type="color"
                                value={variant.hex || '#000000'}
                                onChange={(e) => updateVariant(vIndex, 'hex', e.target.value)}
                                className="admin-color-input"
                              />
                              <input
                                type="text"
                                value={variant.hex}
                                onChange={(e) => updateVariant(vIndex, 'hex', e.target.value)}
                                className="admin-color-hex"
                                placeholder="#000000"
                              />
                              {variant.hex && (
                                <button
                                  type="button"
                                  className="admin-btn-remove-color"
                                  title="Remove color"
                                  onClick={() => updateVariant(vIndex, 'hex', '')}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                            <div className="admin-color-presets">
                              {presetColors.map((c) => (
                                <button
                                  key={c.hex + c.name}
                                  type="button"
                                  className={`admin-color-preset ${variant.hex.toLowerCase() === c.hex.toLowerCase() ? 'selected' : ''}`}
                                  style={{ background: c.hex }}
                                  title={`${c.name} — ${c.hex}`}
                                  onClick={() => {
                                    updateVariant(vIndex, 'hex', c.hex);
                                    if (!variant.colorName) updateVariant(vIndex, 'colorName', c.name);
                                  }}
                                >
                                  <span className="admin-color-preset-label">{c.hex}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="admin-form-group">
                          <label>Product Images *</label>
                          {errors[`variantImages_${vIndex}`] && (
                            <span className="admin-field-error" style={{ marginLeft: '0.5rem' }}>{errors[`variantImages_${vIndex}`]}</span>
                          )}
                          <div className="admin-image-upload-area">
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => handleImageUpload(vIndex, e.target.files)}
                              style={{ display: 'none' }}
                            />
                            <button
                              type="button"
                              className="admin-upload-btn"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                            >
                              {uploading ? (
                                <span className="admin-login-loading">
                                  <span className="admin-login-spinner" />
                                  Uploading...
                                </span>
                              ) : (
                                <>
                                  <span>📷</span>
                                  <span>Click to Upload Images</span>
                                  <span className="admin-upload-hint">JPG, PNG, WebP — Max 5MB each</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="admin-form-group">
                          <label>Or Add Image URL</label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              id={`url-input-${vIndex}`}
                              type="url"
                              placeholder="https://example.com/image.jpg"
                              className="admin-url-input"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleUrlAdd(vIndex, (e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="admin-btn admin-btn-sm-outline"
                              onClick={() => {
                                const input = document.getElementById(`url-input-${vIndex}`) as HTMLInputElement;
                                if (input) {
                                  handleUrlAdd(vIndex, input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {variant.images.length > 0 && (
                          <div className="admin-image-preview-grid">
                            {variant.images.map((img, imgIndex) => (
                              <div key={imgIndex} className="admin-image-preview-item">
                                <img onError={(e)=>{const t=e.target as HTMLImageElement; if(!t.dataset.fallback){t.dataset.fallback='1'; t.style.display='none';}}} width={400} height={400} loading="lazy" decoding="async" src={resolveUploadUrl(img)} alt={`Preview ${imgIndex + 1}`} />
                                <button
                                  type="button"
                                  className="admin-image-remove"
                                  onClick={() => removeImage(vIndex, imgIndex)}
                                >
                                  ×
                                </button>
                                {imgIndex === 0 && (
                                  <span className="admin-image-main-badge">Main</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  ))}
                </div>
              </div>

              <div className="admin-modal-footer">
                <button onClick={() => setShowModal(false)} className="admin-btn admin-btn-outline">Cancel</button>
                <button onClick={handleSave} className="admin-btn admin-btn-primary">
                  {editing ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
