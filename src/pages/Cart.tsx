import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { getProduct } from '../lib/productStore';
import { resolveUploadUrl } from '../lib/api';
import type { CartItem } from '../data/products';
import { isOutOfStock, getQuantity } from '../data/products';
import ZariDivider from '../components/ZariDivider';

interface CartProps {
  cart: CartItem[];
  updateQty: (id: string, colorIndex: number, qty: number) => void;
  removeFromCart: (id: string, colorIndex: number) => void;
}

export default function Cart({ cart, updateQty, removeFromCart }: CartProps) {
  const navigate = useNavigate();
  const handleCheckout = () => {
    const user = localStorage.getItem('reshamUser');
    if (!user) {
      navigate('/login?redirect=/checkout');
      return;
    }
    navigate('/checkout');
  };
  const items = cart
    .map((ci) => ({ ci, product: getProduct(ci.id) }))
    .filter((row) => row.product !== undefined)
    .map((row) => ({
      ...row,
      soldOut: isOutOfStock(row.product),
      available: getQuantity(row.product),
    }));

  const subtotal = items.reduce((sum, { ci, product }) => sum + product!.price * ci.qty, 0);
  const mrpTotal = items.reduce((sum, { ci, product }) => sum + (product!.mrp ?? product!.price) * ci.qty, 0);
  const savings = mrpTotal - subtotal;
  const shipping = 0;

  return (
    <div className="container" style={{ padding: '3rem 0 5rem', maxWidth: 1060 }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span className="eyebrow">Your Selection</span>
        <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', marginTop: '0.4rem', fontStyle: 'italic' }}>Shopping Bag</h1>
      </div>
      <ZariDivider />

      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', padding: '4rem 1rem' }}
        >
          <div style={{ fontSize: '3.5rem' }}>🛍</div>
          <h2 style={{ fontSize: '1.5rem', marginTop: '0.75rem' }}>Your bag is empty</h2>
          <p style={{ color: 'var(--ink-soft)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Discover handwoven sarees and ornaments made for you.
          </p>
          <Link to="/shop" className="btn btn-solid" style={{ marginTop: '1.5rem' }}>
            Start Shopping →
          </Link>
        </motion.div>
      ) : (
        <div
          className="cart-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr',
            gap: '2rem',
            marginTop: '2rem',
            alignItems: 'start',
          }}
        >
          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <AnimatePresence>
              {items.map(({ ci, product, soldOut, available }) => (
                <motion.div
                  key={`${ci.id}-${ci.colorIndex}`}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    background: 'var(--ivory-deep)',
                    borderRadius: 'var(--radius)',
                    padding: '1rem',
                  }}
                >
                  <Link to={`/product/${product!.id}`} style={{ flexShrink: 0 }}>
                    <img
                      src={resolveUploadUrl(product!.variants[ci.colorIndex]?.images[0] ?? product!.variants[0].images[0])}
                      alt={product!.name}
                      loading="lazy"
                      decoding="async"
                      width={92}
                      height={115}
                      onError={(e) => { const t = e.target as HTMLImageElement; if (!t.dataset.fallback) { t.dataset.fallback='1'; t.src='https://images.pexels.com/photos/5585346/pexels-photo-5585346.jpeg?w=200'; } }}
                      style={{ width: 92, height: 115, objectFit: 'cover', borderRadius: 'var(--radius-sm)', aspectRatio: '92 / 115' }}
                    />
                  </Link>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <Link to={`/product/${product!.id}`} style={{ fontWeight: 500, fontSize: '0.95rem', lineHeight: 1.3 }}>
                          {product!.name}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
                          {product!.variants[ci.colorIndex]?.colorName ?? product!.variants[0].colorName}
                        </div>
                        {soldOut && (
                          <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Out of Stock
                          </div>
                        )}
                        {!soldOut && available > 0 && available <= 2 && (
                          <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600, marginTop: 2 }}>
                            Only {available} left
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(ci.id, ci.colorIndex)}
                        aria-label="Remove item"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: '1rem', padding: 2, flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={() => updateQty(ci.id, ci.colorIndex, ci.qty - 1)}
                          aria-label="Decrease quantity"
                          className="qty-btn"
                          style={{ borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--ivory)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                        >
                          −
                        </button>
                        <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 500 }}>{ci.qty}</span>
                        <button
                          onClick={() => updateQty(ci.id, ci.colorIndex, ci.qty + 1)}
                          aria-label="Increase quantity"
                          className="qty-btn"
                          disabled={soldOut || (available > 0 && ci.qty >= available)}
                          style={{
                            borderRadius: '50%',
                            border: '1px solid var(--line)',
                            background: 'var(--ivory)',
                            cursor: soldOut || (available > 0 && ci.qty >= available) ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            lineHeight: 1,
                            opacity: soldOut || (available > 0 && ci.qty >= available) ? 0.4 : 1,
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '1.15rem', color: 'var(--maroon)', fontWeight: 600 }}>
                          ₹{(product!.price * ci.qty).toLocaleString('en-IN')}
                        </div>
                        {product!.mrp && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', textDecoration: 'line-through' }}>
                            ₹{(product!.mrp * ci.qty).toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              background: 'var(--ivory-deep)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              padding: '1.5rem',
              position: 'sticky',
              top: '120px',
            }}
          >
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>Order Summary</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Subtotal ({items.length} item{items.length > 1 ? 's' : ''})</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              {savings > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--teal)' }}>
                  <span>Discount</span>
                  <span>− ₹{savings.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Shipping</span>
                <span style={{ color: 'var(--teal)', fontWeight: 600 }}>FREE</span>
              </div>
              <div style={{ borderTop: '1px solid var(--line)', margin: '0.4rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 600 }}>
                <span>Total</span>
                <span style={{ fontFamily: 'var(--font-body)', color: 'var(--maroon)' }}>
                  ₹{(subtotal + shipping).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <button onClick={handleCheckout} className="btn btn-solid" style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}>
              Proceed to Checkout →
            </button>
            <Link to="/shop" className="eyebrow" style={{ display: 'block', textAlign: 'center', marginTop: '1rem', color: 'var(--maroon)' }}>
              Continue Shopping
            </Link>
          </motion.div>
        </div>
      )}
    </div>
  );
}