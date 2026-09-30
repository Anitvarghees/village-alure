import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Product } from '../data/products';
import { isOutOfStock } from '../data/products';
import { resolveUploadUrl } from '../lib/api';

interface ProductCardProps {
  product: Product;
  index?: number;
  isLiked?: boolean;
  onToggleLike?: (id: string) => void;
}

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%23f5f0ea'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Inter,sans-serif' font-size='16' fill='%23b7a48a'%3ENo Image%3C/text%3E%3C/svg%3E";

export default function ProductCard({ product, index = 0, isLiked = false, onToggleLike }: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const soldOut = isOutOfStock(product);
  const primary = product.variants[0] ?? { images: [], colorName: '', hex: '#ccc' };
  const img0 = resolveUploadUrl(primary.images[0] || '') || PLACEHOLDER;
  const img1 = resolveUploadUrl(primary.images[1] || primary.images[0] || '') || img0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
    >
      <Link
        to={`/product/${product.id}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ display: 'block' }}
      >
        <motion.div
          animate={{
            y: hovered ? -6 : 0,
            boxShadow: hovered
              ? '0 16px 40px rgba(36, 27, 21, 0.15), 0 6px 16px rgba(36, 27, 21, 0.08)'
              : '0 4px 12px rgba(36, 27, 21, 0.06)',
          }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--ivory-deep)',
            borderRadius: 'var(--radius)',
          }}
        >
          <div
            className="product-card-media"
            style={{
              position: 'relative',
              overflow: 'hidden',
              aspectRatio: '4 / 5',
              minHeight: 320,
              background: 'var(--ivory-deep)',
            }}
          >
            <motion.img
              src={img0}
              alt={product.name}
              loading="lazy"
              decoding="async"
              crossOrigin="anonymous"
              width={400}
              height={500}
              animate={{ opacity: hovered ? 0 : soldOut ? 0.5 : 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: hovered ? 'scale(1.08)' : 'none', aspectRatio: '4 / 5' }}
              onError={(e) => { const t = e.target as HTMLImageElement; if (!t.dataset.fallback) { t.dataset.fallback='1'; t.src = PLACEHOLDER; } }}
            />
            <motion.img
              src={img1}
              alt={`${product.name} alternate view`}
              loading="lazy"
              decoding="async"
              crossOrigin="anonymous"
              width={400}
              height={500}
              animate={{ opacity: hovered ? (soldOut ? 0.5 : 1) : 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: hovered ? 'scale(1.08)' : 'none', aspectRatio: '4 / 5' }}
              onError={(e) => { const t = e.target as HTMLImageElement; if (!t.dataset.fallback) { t.dataset.fallback='1'; t.src = PLACEHOLDER; } }}
            />

            {/* Quick view overlay on hover */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(36,27,21,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <motion.span
                initial={{ y: 10, opacity: 0 }}
                animate={hovered ? { y: 0, opacity: 1 } : { y: 10, opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                style={{
                  background: 'var(--ivory)',
                  color: 'var(--maroon)',
                  padding: '0.5rem 1.2rem',
                  fontSize: '0.78rem',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                Quick View
              </motion.span>
            </motion.div>

            {/* Like button */}
            {onToggleLike && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleLike(product.id);
                }}
                aria-label={isLiked ? 'Remove from liked' : 'Add to liked'}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(4px)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 5,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.9)')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={isLiked ? 'var(--maroon)' : 'none'} stroke={isLiked ? 'var(--maroon)' : '#1a1a1a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </motion.button>
            )}

            {product.mrp && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="eyebrow"
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  background: 'var(--maroon)',
                  color: 'var(--ivory)',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.72rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% off
              </motion.span>
            )}
          </div>

          <div style={{ padding: '1rem 0.75rem 0.75rem' }}>
            <div className="eyebrow" style={{ color: 'var(--ink-soft)', marginBottom: '0.3rem' }}>
              {product.fabric}
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 500, lineHeight: 1.3 }}>{product.name}</h3>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginTop: '0.5rem' }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '1.55rem',
                  fontWeight: 600,
                  color: 'var(--maroon)',
                  letterSpacing: '-0.01em',
                }}
              >
                ₹{product.price.toLocaleString('en-IN')}
              </span>
            {soldOut && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  zIndex: 6,
                  background: 'rgba(36,27,21,0.88)',
                  color: '#fff',
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.7rem',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                Out of Stock
              </span>
            )}

            {product.mrp && (
                <span
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--ink-soft)',
                    textDecoration: 'line-through',
                    opacity: 0.6,
                  }}
                >
                  ₹{product.mrp.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
