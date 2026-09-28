import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ProductCard from '../components/ProductCard';
import ZariDivider from '../components/ZariDivider';
import { products as localProducts } from '../data/products';
import { api } from '../lib/api';
import type { Product as ProductType } from '../data/products';
import type { Category } from '../lib/api';

interface ShopProps {
  likedProducts: string[];
  onToggleLike: (id: string) => void;
}

const SORT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Price: Low to High', value: 'low' },
  { label: 'Price: High to Low', value: 'high' },
];

const PRICE_RANGES = [
  { label: '₹500 and Below', min: 0, max: 500 },
  { label: '₹501 – ₹1,000', min: 501, max: 1000 },
  { label: '₹1,001 – ₹2,000', min: 1001, max: 2000 },
  { label: '₹2,001 – ₹3,000', min: 2001, max: 3000 },
  { label: '₹3,001 – ₹5,000', min: 3001, max: 5000 },
  { label: '₹5,001 – ₹8,000', min: 5001, max: 8000 },
  { label: '₹8,001 – ₹15,000', min: 8001, max: 15000 },
  { label: '₹15,001 – ₹25,000', min: 15001, max: 25000 },
  { label: '₹25,000 and Above', min: 25001, max: 999999 },
];

const SLIDER_MIN = 0;
const SLIDER_MAX = 30000;
const SLIDER_STEP = 500;

const formatPrice = (v: number) =>
  v >= 1000 ? `₹${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `₹${v}`;

export default function Shop({ likedProducts, onToggleLike }: ShopProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const [products, setProducts] = useState<ProductType[]>(localProducts);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    Promise.all([api.products.getAll(), api.categories.getAll()]).then(([apiProducts, cats]) => {
      setCategories(cats);
      if (apiProducts.length === 0) return;
      const validNames = new Set(cats.map((c) => c.name));
      const validSubMap: Record<string, boolean> = {};
      cats.forEach((c) => {
        c.subcategories.forEach((sub) => {
          validSubMap[`${c.name}::${sub}`] = true;
        });
      });
      const merged = localProducts.map((lp) => {
        const apiP = apiProducts.find((p) => p.id === lp.id);
        if (apiP && apiP.variants.some((v) => v.images.length > 0)) return apiP;
        return lp;
      });
      const newProducts = apiProducts.filter((p) => !localProducts.some((lp) => lp.id === p.id));
      const all = [...newProducts, ...merged];
      const filtered = all.filter((p) => {
        if (!validNames.has(p.category)) return false;
        if (p.subCategory && !validSubMap[`${p.category}::${p.subCategory}`]) return false;
        return true;
      });
      setProducts(filtered);
    }).catch(() => {});
  }, []);
  const activeCategory = searchParams.get('category');
  const activeSub = activeCategory ? searchParams.get('sub') : null;
  const activeSort = searchParams.get('sort') ?? '';
  const activeMin = searchParams.get('min') ?? '';
  const activeMax = searchParams.get('max') ?? '';
  const activePreset = searchParams.get('preset') ?? '';

  const [sliderMin, setSliderMin] = useState(activeMin ? Number(activeMin) : SLIDER_MIN);
  const [sliderMax, setSliderMax] = useState(activeMax ? Number(activeMax) : SLIDER_MAX);

  const filtered = products
    .filter(
      (p) =>
        (!activeCategory || p.category === activeCategory) &&
        (!activeSub || p.subCategory === activeSub || (!p.subCategory && (p.name.toLowerCase().includes(activeSub.toLowerCase()) || p.fabric.toLowerCase().includes(activeSub.toLowerCase()))))
    )
    .filter((p) => {
      if (activeMin && p.price < Number(activeMin)) return false;
      if (activeMax && p.price > Number(activeMax)) return false;
      return true;
    })
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subCategory && p.subCategory.toLowerCase().includes(q)) ||
        p.fabric.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (activeSort === 'low') return a.price - b.price;
      if (activeSort === 'high') return b.price - a.price;
      return 0;
    });

  const subcats = activeCategory
    ? categories.find((c) => c.name === activeCategory)?.subcategories || []
    : undefined;
  const hasPriceFilter = activeMin || activeMax;

  const buildParams = useCallback(
    (overrides: Record<string, string | null>) => {
      const params: Record<string, string> = {};
      if (activeCategory) params.category = activeCategory;
      if (activeSub) params.sub = activeSub;
      if (activeSort) params.sort = activeSort;
      if (activeMin) params.min = activeMin;
      if (activeMax) params.max = activeMax;
      if (activePreset) params.preset = activePreset;
      Object.entries(overrides).forEach(([k, v]) => {
        if (v === null) delete params[k];
        else params[k] = v;
      });
      return params;
    },
    [activeCategory, activeSub, activeSort, activeMin, activeMax, activePreset]
  );

  const setSub = (sub: string | null) => {
    if (!activeCategory) return;
    setSearchParams(buildParams({ sub, min: null, max: null, preset: null }));
  };

  const setSort = (sort: string) => {
    setSearchParams(buildParams({ sort: sort || null }));
  };

  const applySlider = () => {
    const params: Record<string, string> = {};
    if (activeCategory) params.category = activeCategory;
    if (activeSub) params.sub = activeSub;
    if (activeSort) params.sort = activeSort;
    if (sliderMin > SLIDER_MIN) params.min = String(sliderMin);
    if (sliderMax < SLIDER_MAX) params.max = String(sliderMax);
    setSearchParams(params);
  };

  const applyPreset = (preset: typeof PRICE_RANGES[number]) => {
    if (activePreset === preset.label) {
      setSliderMin(SLIDER_MIN);
      setSliderMax(SLIDER_MAX);
      setSearchParams(buildParams({ min: null, max: null, preset: null }));
    } else {
      setSliderMin(preset.min);
      setSliderMax(preset.max);
      setSearchParams({
        ...(activeCategory && { category: activeCategory }),
        ...(activeSub && { sub: activeSub }),
        ...(activeSort && { sort: activeSort }),
        min: String(preset.min),
        max: String(preset.max),
        preset: preset.label,
      });
    }
  };

  const clearPrice = () => {
    setSliderMin(SLIDER_MIN);
    setSliderMax(SLIDER_MAX);
    setSearchParams(buildParams({ min: null, max: null, preset: null }));
  };

  const clearAll = () => {
    setSliderMin(SLIDER_MIN);
    setSliderMax(SLIDER_MAX);
    const params: Record<string, string> = {};
    if (activeCategory) params.category = activeCategory;
    setSearchParams(params);
  };

  const minPct = Math.max(0, Math.min(100, ((sliderMin - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100));
  const maxPct = Math.max(0, Math.min(100, ((sliderMax - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100));

  const rangeLabel = sliderMin === SLIDER_MIN && sliderMax >= SLIDER_MAX
    ? 'All Prices'
    : sliderMin === SLIDER_MIN
      ? `Up to ${formatPrice(sliderMax)}`
      : `${formatPrice(sliderMin)} – ${sliderMax >= SLIDER_MAX ? '₹30k+' : formatPrice(sliderMax)}`;

  /* ─── Shared filter content (used in sidebar + drawer) ─── */
  const FilterContent = ({ onApply }: { onApply?: () => void }) => (
    <>
      {/* Subcategories */}
      {subcats && (
        <div className="filter-section">
          <div className="filter-section-title">{activeCategory}</div>
          <div className="filter-options">
            <button className={`filter-opt ${!activeSub ? 'active' : ''}`} onClick={() => { setSub(null); onApply?.(); }}>
              All {activeCategory}
            </button>
            {subcats.map((sub) => (
              <button key={sub} className={`filter-opt ${activeSub === sub ? 'active' : ''}`} onClick={() => { setSub(sub); onApply?.(); }}>
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price Range */}
      <div className="filter-section">
        <div className="filter-section-title">Price Range</div>

        {/* Selected range header */}
        <div className="price-range-header">
          <div className="eyebrow" style={{ color: 'var(--ink-soft)', fontSize: '0.58rem', marginBottom: '0.25rem' }}>
            Selected Price Range
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-body)' }}>
            {rangeLabel}
          </div>
        </div>

        {/* Slider */}
        <div className="slider-track">
          <div className="slider-track-bg" />
          <div className="slider-track-active" style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }} />
          <input
            type="range"
            min={SLIDER_MIN} max={SLIDER_MAX} step={SLIDER_STEP} value={sliderMin}
            onChange={(e) => setSliderMin(Math.min(Number(e.target.value), sliderMax - SLIDER_STEP))}
            onMouseUp={applySlider} onTouchEnd={applySlider}
            className="dual-range-input"
            style={{ zIndex: 3 }}
          />
          <input
            type="range"
            min={SLIDER_MIN} max={SLIDER_MAX} step={SLIDER_STEP} value={sliderMax}
            onChange={(e) => setSliderMax(Math.max(Number(e.target.value), sliderMin + SLIDER_STEP))}
            onMouseUp={applySlider} onTouchEnd={applySlider}
            className="dual-range-input"
            style={{ zIndex: 4 }}
          />
        </div>
        <div className="slider-dots">
          {PRICE_RANGES.map((range) => (
            <div key={range.label} className="slider-dot" />
          ))}
        </div>

        {/* Preset checkboxes */}
        <div className="filter-options" style={{ marginTop: '0.75rem' }}>
          {PRICE_RANGES.map((range) => {
            const checked = activePreset === range.label;
            return (
              <button key={range.label} className="filter-opt" onClick={() => { applyPreset(range); onApply?.(); }}>
                <div className={`custom-checkbox ${checked ? 'checked' : ''}`}>
                  {checked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <span>{range.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort */}
      <div className="filter-section">
        <div className="filter-section-title">Sort By</div>
        <div className="filter-options">
          {SORT_OPTIONS.map((opt) => (
            <button key={opt.value} className={`filter-opt ${activeSort === opt.value ? 'active' : ''}`} onClick={() => { setSort(opt.value); onApply?.(); }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="container" style={{ padding: '3rem 0 5rem' }}>
      <div className="shop-header-row">
        <div className="shop-search-wrap">
          <svg className="shop-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="shop-search-input"
            type="text"
            placeholder="Search by name,category"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="shop-search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <div className="shop-header-text">
          <span className="eyebrow">The Full Collection</span>
          <h1 style={{ fontSize: '2.6rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
            {activeCategory ?? 'All Products'}
          </h1>
        </div>
      </div>

      <ZariDivider />

      {/* ═══════ DESKTOP: left sidebar + product grid ═══════ */}
      {subcats && (
        <div className="shop-layout">
          {/* Left sidebar */}
          <aside className="shop-sidebar desktop-filter-bar">
            <div className="sidebar-header">
              <span className="eyebrow" style={{ color: 'var(--ink)', fontSize: '0.7rem' }}>Filters</span>
              {hasPriceFilter && (
                <button onClick={clearAll} className="eyebrow" style={{ background: 'none', border: 'none', color: 'var(--maroon)', fontSize: '0.62rem', cursor: 'pointer' }}>
                  Clear All
                </button>
              )}
            </div>
            <FilterContent />
          </aside>

          {/* Product grid */}
          <div>
            {/* Mobile filter button — on top of products */}
            <button className="mobile-filter-btn" onClick={() => setFilterOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
              </svg>
              Filter
            </button>

            {/* Active filters bar */}
            {hasPriceFilter && (
              <div className="active-filter-bar">
                <button onClick={clearPrice} className="eyebrow active-filter-tag">
                  {rangeLabel} ✕
                </button>
              </div>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCategory ?? 'all'}-${activeSub ?? 'all'}-${activeSort}-${activeMin}-${activeMax}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="shop-grid"
              >
                {filtered.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} isLiked={likedProducts.includes(p.id)} onToggleLike={onToggleLike} />
                ))}
              </motion.div>
            </AnimatePresence>
            {filtered.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: '3rem 0' }}>
                {searchQuery ? `No products found for "${searchQuery}".` : 'No products found in this category yet.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Non-category pages (no sidebar) */}
      {!subcats && (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeCategory ?? 'all'}-${activeSub ?? 'all'}-${activeSort}-${activeMin}-${activeMax}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="shop-grid"
            >
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} isLiked={likedProducts.includes(p.id)} onToggleLike={onToggleLike} />
              ))}
            </motion.div>
          </AnimatePresence>
          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
              {searchQuery ? `No products found for "${searchQuery}".` : 'No products found in this category yet.'}
            </p>
          )}
        </>
      )}

      {/* ═══════ MOBILE drawer overlay ═══════ */}
      <AnimatePresence>
        {filterOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={() => setFilterOpen(false)} className="filter-overlay" />
        )}
      </AnimatePresence>

      {/* ═══════ MOBILE drawer ═══════ */}
      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mobile-filter-drawer"
          >
            {/* Drawer header */}
            <div className="drawer-header">
              <span className="eyebrow" style={{ color: 'var(--ink)', fontSize: '0.7rem' }}>Filters</span>
              <button onClick={() => setFilterOpen(false)} aria-label="Close" className="drawer-close">✕</button>
            </div>

            {/* Filter content */}
            <div className="drawer-body">
              <FilterContent onApply={() => setFilterOpen(false)} />
            </div>

            {/* Bottom buttons */}
            <div className="drawer-footer">
              <button onClick={() => { clearAll(); setFilterOpen(false); }} className="drawer-btn outline">Clear All</button>
              <button onClick={() => setFilterOpen(false)} className="drawer-btn solid">Apply</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
