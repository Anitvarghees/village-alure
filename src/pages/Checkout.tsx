import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getProduct } from '../lib/productStore';
import type { CartItem } from '../data/products';
import ZariDivider from '../components/ZariDivider';
import { api, resolveUploadUrl } from '../lib/api';
import { writeUser } from '../lib/auth';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response: { error: { description: string } }) => void) => void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface CheckoutProps {
  cart: CartItem[];
  clearCart: () => void;
}

interface PlacedOrder {
  orderId: string;
  total: number;
  name: string;
  phone: string;
  payment: string;
  date: string;
  whatsappUrl?: string;
}

export default function Checkout({ cart, clearCart }: CheckoutProps) {
  const navigate = useNavigate();
  useEffect(() => {
    const user = localStorage.getItem('reshamUser');
    if (!user) navigate('/login?redirect=/checkout', { replace: true });
  }, [navigate]);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', state: 'Delhi', pincode: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const items = cart
    .map((ci) => ({ ci, product: getProduct(ci.id) }))
    .filter((row) => row.product !== undefined);
  const subtotal = items.reduce((sum, { ci, product }) => sum + product!.price * ci.qty, 0);
  const shipping = 0;
  const total = subtotal + shipping;

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const finalizeOrder = useCallback(async (orderItems: { id: string; colorIndex: number; qty: number }[], paymentMethod: string, paymentId = '') => {
    const result = await api.orders.create({
      total,
      name: form.name,
      email: form.email,
      phone: form.phone,
      payment: paymentMethod,
      paymentId,
      items: orderItems,
      address: form.address,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
    });
    clearCart();
    const savedUser = localStorage.getItem('reshamUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      writeUser({ ...user, email: form.email, phone: form.phone, name: form.name || user.name }, 'update');
    } else {
      writeUser({ email: form.email, name: form.name, phone: form.phone }, 'update');
    }
    const localOrder = {
      orderId: result.orderId,
      total,
      name: form.name,
      phone: form.phone,
      payment: paymentMethod,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'Pending',
      items: orderItems,
    };
    const existingOrders = JSON.parse(localStorage.getItem('reshamOrders') || '[]');
    existingOrders.unshift(localOrder);
    localStorage.setItem('reshamOrders', JSON.stringify(existingOrders));

    setPlaced({
      orderId: result.orderId,
      total,
      name: form.name,
      phone: form.phone,
      payment: paymentMethod,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      whatsappUrl: result.whatsappUrl || '',
    });
    window.scrollTo(0, 0);
  }, [total, form, clearCart, items]);

  const openRazorpay = useCallback(async (orderItems: { id: string; colorIndex: number; qty: number }[]) => {
    const razorpayKey = (import.meta as unknown as { env: { VITE_RAZORPAY_KEY_ID?: string } }).env.VITE_RAZORPAY_KEY_ID || '';
    if (!razorpayKey) {
      setError('Payment configuration error. Please contact support.');
      setLoading(false);
      return;
    }

    if (!window.Razorpay) {
      setError('Payment system failed to load. Please refresh and try again.');
      setLoading(false);
      return;
    }

    const amountInPaise = total * 100;
    const orderData = await api.payments.createOrder(amountInPaise, `order_${Date.now()}`);

    const options: RazorpayOptions = {
      key: razorpayKey,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'Village Allure',
      description: `Order Payment - ${items.length} item(s)`,
      order_id: orderData.orderId,
      handler: async (response: RazorpayResponse) => {
        try {
          await api.payments.verify(response);
          await finalizeOrder(orderItems, 'Paid via Razorpay', response.razorpay_payment_id);
        } catch {
          setError('Payment verification failed. Please contact support.');
          setLoading(false);
        }
      },
      prefill: {
        name: form.name,
        email: form.email,
        contact: form.phone,
      },
      theme: { color: '#6b1e23' },
      modal: {
        ondismiss: () => {
          setLoading(false);
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (response: { error: { description: string } }) => {
      console.error('Razorpay payment failed:', response.error);
      setError(`Payment failed: ${response.error.description}`);
      setLoading(false);
    });
    rzp.open();
  }, [total, items, form, finalizeOrder]);

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Check stock availability before placing order
      for (const ci of cart) {
        const product = getProduct(ci.id);
        if (product && (product as any).quantity != null && (product as any).quantity > 0 && ci.qty > (product as any).quantity) {
          setError(`Not enough stock for "${product.name}". Only ${(product as any).quantity} piece(s) available.`);
          setLoading(false);
          return;
        }
      }
      const orderItems = cart.map((ci) => ({ id: ci.id, colorIndex: ci.colorIndex, qty: ci.qty }));
      await openRazorpay(orderItems);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to place order. Please try again.';
      setError(message);
      setLoading(false);
    }
  };

  if (placed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="container"
        style={{ maxWidth: 620, textAlign: 'center', padding: '5rem 1rem' }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
          style={{
            width: 84,
            height: 84,
            margin: '0 auto',
            borderRadius: '50%',
            background: 'var(--teal)',
            color: 'var(--ivory)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.4rem',
          }}
        >
          ✓
        </motion.div>
        <span className="eyebrow" style={{ display: 'block', marginTop: '2rem' }}>Order Confirmed</span>
        <h1 style={{ fontSize: '2rem', marginTop: '0.5rem', fontStyle: 'italic' }}>Thank you, {placed.name.split(' ')[0]}!</h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: '0.75rem', lineHeight: 1.8 }}>
          Your order <strong style={{ color: 'var(--maroon)' }}>{placed.orderId}</strong> has been placed.
          <br />
          We&apos;ll call you on <strong>{placed.phone}</strong> to confirm your {placed.payment} payment and handwoven
          delivery details.
        </p>
        <ZariDivider />
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          {placed.whatsappUrl && (
            <a
              href={placed.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-solid"
              style={{
                background: '#25D366',
                color: 'white',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Send on WhatsApp
            </a>
          )}
          <Link to="/" className="btn btn-solid">Back to Home</Link>
          <Link to="/shop" className="btn">Continue Shopping →</Link>
        </div>
      </motion.div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container" style={{ maxWidth: 620, textAlign: 'center', padding: '5rem 1rem' }}>
        <h2 style={{ fontSize: '1.6rem' }}>Nothing to check out yet</h2>
        <p style={{ color: 'var(--ink-soft)', marginTop: '0.5rem' }}>Your bag is empty — add a few weaves first.</p>
        <Link to="/shop" className="btn btn-solid" style={{ marginTop: '1.5rem' }}>Shop Now</Link>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.85rem 1rem',
    border: '1px solid var(--line)',
    borderBottom: '2px solid var(--gold-soft)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--ivory-deep)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92rem',
    color: 'var(--ink)',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="container"
      style={{ padding: '3rem 0 5rem', maxWidth: 1080 }}
    >
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span className="eyebrow">Almost There</span>
        <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', marginTop: '0.4rem', fontStyle: 'italic' }}>Checkout</h1>
      </div>
      <ZariDivider />

      <form
        onSubmit={placeOrder}
        className="checkout-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr',
          gap: '2rem',
          marginTop: '2rem',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Shipping Details</h2>
            <div className="checkout-name-phone" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="eyebrow" style={{ color: 'var(--ink-soft)', fontSize: '0.68rem' }}>Full Name</label>
                <input required value={form.name} onChange={set('name')} placeholder="Your name" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="eyebrow" style={{ color: 'var(--ink-soft)', fontSize: '0.68rem' }}>Email Address</label>
                <input required type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '1rem' }}>
              <label className="eyebrow" style={{ color: 'var(--ink-soft)', fontSize: '0.68rem' }}>Phone Number (WhatsApp Number)</label>
              <input required value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" pattern="[0-9]{10}" maxLength={10} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '1rem' }}>
              <label className="eyebrow" style={{ color: 'var(--ink-soft)', fontSize: '0.68rem' }}>Full Address</label>
              <input required value={form.address} onChange={set('address')} placeholder="House, street, landmark" style={inputStyle} />
            </div>
            <div className="checkout-address" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="eyebrow" style={{ color: 'var(--ink-soft)', fontSize: '0.68rem' }}>City</label>
                <input required value={form.city} onChange={set('city')} placeholder="City" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="eyebrow" style={{ color: 'var(--ink-soft)', fontSize: '0.68rem' }}>State</label>
                <select value={form.state} onChange={set('state')} style={inputStyle}>
                  <option>Andhra Pradesh</option>
                  <option>Arunachal Pradesh</option>
                  <option>Assam</option>
                  <option>Bihar</option>
                  <option>Chhattisgarh</option>
                  <option>Goa</option>
                  <option>Gujarat</option>
                  <option>Haryana</option>
                  <option>Himachal Pradesh</option>
                  <option>Jharkhand</option>
                  <option>Karnataka</option>
                  <option>Kerala</option>
                  <option>Madhya Pradesh</option>
                  <option>Maharashtra</option>
                  <option>Manipur</option>
                  <option>Meghalaya</option>
                  <option>Mizoram</option>
                  <option>Nagaland</option>
                  <option>Odisha</option>
                  <option>Punjab</option>
                  <option>Rajasthan</option>
                  <option>Sikkim</option>
                  <option>Tamil Nadu</option>
                  <option>Telangana</option>
                  <option>Tripura</option>
                  <option>Uttar Pradesh</option>
                  <option>Uttarakhand</option>
                  <option>West Bengal</option>
                  <option>Andaman and Nicobar Islands</option>
                  <option>Chandigarh</option>
                  <option>Dadra and Nagar Haveli and Daman and Diu</option>
                  <option>Delhi</option>
                  <option>Jammu and Kashmir</option>
                  <option>Ladakh</option>
                  <option>Lakshadweep</option>
                  <option>Puducherry</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="eyebrow" style={{ color: 'var(--ink-soft)', fontSize: '0.68rem' }}>PIN Code</label>
                <input required value={form.pincode} onChange={set('pincode')} placeholder="6-digit" pattern="[0-9]{6}" maxLength={6} style={inputStyle} />
              </div>
            </div>
          </div>


        </div>

        <div style={{ background: 'var(--ivory-deep)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '1.5rem', position: 'sticky', top: '120px' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Your Order</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1rem' }}>
            {items.map(({ ci, product }) => (
              <div key={`${ci.id}-${ci.colorIndex}`} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <img
                  src={resolveUploadUrl(product!.variants[ci.colorIndex]?.images[0] ?? product!.variants[0].images[0])}
                  alt={product!.name}
                  loading="lazy"
                  decoding="async"
                  width={46}
                  height={58}
                  onError={(e) => { const t = e.target as HTMLImageElement; if (!t.dataset.fallback) { t.dataset.fallback='1'; t.src='https://images.pexels.com/photos/5585346/pexels-photo-5585346.jpeg?w=200'; } }}
                  style={{ width: 46, height: 58, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0, aspectRatio: '46 / 58' }}
                />
                <div style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', lineHeight: 1.3 }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product!.name}</div>
                  <div style={{ color: 'var(--ink-soft)' }}>Qty {ci.qty}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-body)', color: 'var(--maroon)', fontSize: '0.9rem' }}>
                  ₹{(product!.price * ci.qty).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ink-soft)' }}>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ink-soft)' }}>Shipping</span>
              <span style={{ color: 'var(--teal)', fontWeight: 600 }}>FREE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 600, marginTop: '0.25rem' }}>
              <span>Total</span>
              <span style={{ fontFamily: 'var(--font-body)', color: 'var(--maroon)' }}>₹{total.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: '0.9rem', lineHeight: 1.6 }}>
            Made-to-order pieces ship in 10–14 days; ready stock in 3–5 days. Free returns within 7 days for unworn, tag-intact sarees.
          </p>
          {error && (
            <p style={{ color: '#c0392b', fontSize: '0.82rem', textAlign: 'center', marginTop: '0.75rem' }}>{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn btn-solid" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Processing...' : `Pay ₹${total.toLocaleString('en-IN')} `}
          </button>
          <Link to="/cart" className="eyebrow" style={{ display: 'block', textAlign: 'center', marginTop: '1rem', color: 'var(--maroon)' }}>
            ← Back to Bag
          </Link>
        </div>
      </form>
    </motion.div>
  );
}