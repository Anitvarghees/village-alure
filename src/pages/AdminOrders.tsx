import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, resolveUploadUrl } from '../lib/api';
import { products as localProducts, type Product } from '../data/products';
import type { Order, OrderTracking, ReturnRequest } from '../lib/api';

const allStatuses = ['Pending', 'Processing', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

const statusColors: Record<string, string> = {
  Pending: '#f59e0b',
  Processing: '#3b82f6',
  Dispatched: '#0ea5e9',
  Shipped: '#8b5cf6',
  'Out for Delivery': '#f97316',
  Delivered: '#10b981',
  Cancelled: '#ef4444',
};

const statusIcons: Record<string, string> = {
  Pending: '⏳',
  Processing: '⚙',
  Dispatched: '📋',
  Shipped: '🚚',
  'Out for Delivery': '🛵',
  Delivered: '✅',
  Cancelled: '❌',
};

const statusGradients: Record<string, string> = {
  Pending: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
  Processing: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
  Dispatched: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
  Shipped: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
  'Out for Delivery': 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
  Delivered: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
  Cancelled: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
};

const statusTextColors: Record<string, string> = {
  Pending: '#92400e',
  Processing: '#1e40af',
  Dispatched: '#0c4a6e',
  Shipped: '#5b21b6',
  'Out for Delivery': '#9a3412',
  Delivered: '#065f46',
  Cancelled: '#991b1b',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState<{ orderId: string; currentStatus: string } | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [trackingLink, setTrackingLink] = useState('');
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [products, setProducts] = useState<Product[]>(localProducts);

  const loadProducts = async () => {
    const merged = new Map<string, Product>();
    localProducts.forEach((p) => merged.set(p.id, p));
    try {
      (await api.products.getAll()).forEach((p) => merged.set(p.id, p));
    } catch {
      // keep local fallback
    }
    setProducts([...merged.values()]);
  };

  const productName = (id: string) => products.find((p) => p.id === id)?.name || id;

  const productImage = (id: string, colorIndex?: number) => {
    const p = products.find((x) => x.id === id);
    return p?.variants?.[colorIndex ?? 0]?.images?.[0] || p?.variants?.[0]?.images?.[0] || '';
  };

  const loadOrders = async () => {
    try {
      const [data, ret] = await Promise.all([api.orders.getAll(), api.returns.getAll().catch(()=>[])]);
      setOrders(data);
      setReturns(ret as ReturnRequest[]);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      if (String(error.message).includes('401')) alert('Admin session expired');
    } finally { setLoading(false); }
  };

  const returnsByOrder = (id:string) => returns.filter((r)=>r.orderId===id);
  const pendingCount = (id:string) => returns.filter((r)=>r.orderId===id && r.status==='Pending').length;
  const nextFor = (s:string) => ({Pending:'Approved',Approved:'Pickup Scheduled','Pickup Scheduled':'Picked Up','Picked Up':'Completed'} as Record<string,string>)[s];
  const handleReturnStatus = async (rid:string, st:string) => { try{ const u=await api.returns.updateStatus(rid,st); setReturns((p)=>p.map((r)=>r.id===rid?u:r)); }catch(e:any){ alert(e.message); } };

  useEffect(() => {
    loadOrders();
    loadProducts();
  }, []);

  const filtered = orders.filter((o) => {
    const matchesSearch = o.orderId.toLowerCase().includes(search.toLowerCase()) || o.name.toLowerCase().includes(search.toLowerCase()) || o.phone.includes(search);
    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openStatusModal = (order: Order) => {
    setNewStatus(order.status);
    setStatusMessage('');
    setEstimatedDelivery(order.estimatedDelivery || '');
    setOrderNotes(order.notes || '');
    setTrackingLink((order as any).trackingLink || '');
    setStatusModal({ orderId: order.id, currentStatus: order.status });
  };

  const handleDelete = async (id: string, orderId: string) => {
    if (!confirm(`Delete order ${orderId}? This cannot be undone.`)) return;
    try { await api.orders.delete(id); setOrders((p) => p.filter((o) => (o as any).id !== id && (o as any)._id !== id && o.orderId !== orderId)); } catch (e: any) { alert(e.message || 'Delete failed'); }
  };

  const handleStatusUpdate = async () => {
    if (!statusModal) return;
    try {
      const result: any = await api.orders.updateStatus(statusModal.orderId, {
        status: newStatus,
        message: statusMessage || `Status updated to ${newStatus}`,
        estimatedDelivery,
        notes: orderNotes,
        trackingLink: newStatus === 'Dispatched' ? trackingLink : undefined,
      });
      await loadOrders();
      setStatusModal(null);

      if (newStatus === 'Dispatched' && result) {
        if (result.whatsappUrl) {
          window.open(result.whatsappUrl, '_blank');
        }
        if (result.emailUrl) {
          setTimeout(() => window.open(result.emailUrl, '_blank'), 500);
        }
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'Pending').length,
    processing: orders.filter((o) => o.status === 'Processing').length,
    dispatched: orders.filter((o) => o.status === 'Dispatched').length,
    shipped: orders.filter((o) => o.status === 'Shipped').length,
    outForDelivery: orders.filter((o) => o.status === 'Out for Delivery').length,
    delivered: orders.filter((o) => o.status === 'Delivered').length,
    cancelled: orders.filter((o) => o.status === 'Cancelled').length,
  };

  if (loading) {
    return (
      <div className="admin-products-loading">
        <div className="admin-products-spinner" />
        <span>Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="admin-orders-page">
      <div className="admin-products-stats">
        {allStatuses.slice(0, 5).map((s) => {
          const key = s.toLowerCase().replace(/\s+/g, '') as keyof typeof stats;
          return (
            <div key={s} className="admin-products-stat">
              <div className="admin-stat-icon" style={{ background: statusGradients[s], color: statusTextColors[s] }}>
                {statusIcons[s]}
              </div>
              <div className="admin-products-stat-text">
                <span className="admin-products-stat-value">{stats[key]}</span>
                <span className="admin-products-stat-label">{s}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-products-toolbar">
        <div className="admin-products-toolbar-left">
          <div className="admin-products-search-wrap">
            <span className="admin-products-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by ID, name, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-products-search"
            />
            {search && (
              <button className="admin-products-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-products-filter">
            <option value="All">All Statuses</option>
            {allStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
          {filtered.length} order{filtered.length !== 1 ? 's' : ''} found
        </div>
      </div>

      <div className="admin-orders-list">
        {filtered.map((order, index) => (
          <motion.div
            key={order.orderId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`admin-order-card ${expandedOrder === order.orderId ? 'expanded' : ''}`}
          >
            <div className="admin-order-card-main" onClick={() => setExpandedOrder(expandedOrder === order.orderId ? null : order.orderId)}>
              <div className="admin-order-card-status-bar" style={{ background: statusColors[order.status] }} />

              <div className="admin-order-card-info">
                <div className="admin-order-card-header">
                  <div>
                    <span className="admin-order-card-id">{order.orderId}</span>
                    <h4 className="admin-order-card-name">{order.name}</h4>
                  </div>
                  <span
                    className="admin-order-card-badge"
                    style={{
                      background: statusGradients[order.status],
                      color: statusTextColors[order.status],
                    }}
                  >
                    {statusIcons[order.status]} {order.status}
                  </span>
                </div>

                <div className="admin-order-card-details">
                  <div className="admin-order-card-detail">
                    <span className="admin-order-card-detail-label">Phone</span>
                    <span className="admin-order-card-detail-value">{order.phone}</span>
                  </div>
                  <div className="admin-order-card-detail">
                    <span className="admin-order-card-detail-label">Items</span>
                    <span className="admin-order-card-detail-value">{order.items?.length || 0}</span>
                  </div>
                  <div className="admin-order-card-detail">
                    <span className="admin-order-card-detail-label">Payment</span>
                    <span className="admin-order-card-detail-value">{order.payment}</span>
                  </div>
                  <div className="admin-order-card-detail">
                    <span className="admin-order-card-detail-label">Date</span>
                    <span className="admin-order-card-detail-value">{order.date}</span>
                  </div>
                </div>
              </div>

              <div className="admin-order-card-price">
                <span className="admin-order-card-total">₹{order.total.toLocaleString('en-IN')}</span>
                {pendingCount(order.orderId) > 0 && <span style={{ marginTop: 6, display: 'inline-block', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700 }}>↩️ {pendingCount(order.orderId)} Return Pending</span>}
                {returnsByOrder(order.orderId).length > 0 && pendingCount(order.orderId)===0 && <span style={{ marginTop: 6, display: 'inline-block', background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700 }}>↩️ Returned</span>}
              </div>

              <div className="admin-order-card-actions" onClick={(e) => e.stopPropagation()} style={{ display:'flex', gap:'0.4rem' }}>
                <button onClick={() => openStatusModal(order)} className="admin-order-card-update">
                  <span>✏️</span> Update
                </button>
                <button onClick={() => handleDelete((order as any).id || (order as any)._id || order.orderId, order.orderId)} style={{ padding:'0.45rem 0.7rem', background:'white', border:'1px solid #fecaca', color:'#991b1b', borderRadius:8, fontSize:'0.75rem', fontWeight:700, cursor:'pointer' }}>
                  🗑️ Delete
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expandedOrder === order.orderId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="admin-order-card-detail-panel"
                >
                  <div className="admin-order-card-detail-grid">
                    <div className="admin-order-card-detail-section">
                      <span className="admin-order-card-detail-title">Customer</span>
                      <div className="admin-order-card-detail-text">{order.name}</div>
                      <div className="admin-order-card-detail-text">{order.phone}</div>
                      {order.email && <div className="admin-order-card-detail-text muted">{order.email}</div>}
                    </div>
                    <div className="admin-order-card-detail-section">
                      <span className="admin-order-card-detail-title">Shipping Address</span>
                      <div className="admin-order-card-detail-text">{order.address || 'N/A'}</div>
                      <div className="admin-order-card-detail-text">{order.city || ''}, {order.state || ''} {order.pincode || ''}</div>
                    </div>
                    <div className="admin-order-card-detail-section">
                      <span className="admin-order-card-detail-title">Items</span>
                      {order.items?.map((item, i) => {
                        const img = productImage(item.id, item.colorIndex);
                        return (
                          <div key={i} className="admin-order-card-item">
                            {img ? (
                              <img
                                src={resolveUploadUrl(img)}
                                alt={productName(item.id)}
                                loading="lazy"
                                decoding="async"
                                width={400}
                                height={400}
                                onError={(e) => { const t = e.currentTarget; t.style.visibility = 'hidden'; }}
                                className="admin-order-card-item-img"
                              />
                            ) : (
                              <div className="admin-order-card-item-img admin-order-card-item-img-empty">📦</div>
                            )}
                            <div className="admin-order-card-item-info">
                              <span className="admin-order-card-detail-text">{productName(item.id)} × {item.qty}</span>
                              {(item as any).cancelled && <span style={{ fontSize: '0.68rem', background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>❌ CANCELLED{(item as any).cancelReason ? `: ${(item as any).cancelReason}` : ''}</span>}
                            </div>
                          </div>
                        );
                      }) || <div className="admin-order-card-detail-text muted">N/A</div>}
                    </div>
                    <div className="admin-order-card-detail-section">
                      <span className="admin-order-card-detail-title">Payment & Total</span>
                      <div className="admin-order-card-detail-text">{order.payment}</div>
                      <div className="admin-order-card-detail-total">₹{order.total.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="admin-order-card-notes" style={{ background: order.notes.includes('cancelled') ? '#fee2e2' : undefined, border: order.notes.includes('cancelled') ? '1px solid #fecaca' : undefined, borderRadius: order.notes.includes('cancelled') ? 8 : undefined }}>
                      <strong>Notes:</strong> {order.notes}
                    </div>
                  )}

                  {order.tracking && order.tracking.length > 0 && (
                    <div className="admin-order-card-timeline">
                      <span className="admin-order-card-detail-title">Tracking Timeline</span>
                      <div className="admin-timeline">
                        {order.tracking.map((entry: OrderTracking, i: number) => (
                          <div key={i} className="admin-timeline-item">
                            <div
                              className="admin-timeline-dot"
                              style={{
                                background: `linear-gradient(135deg, ${statusColors[entry.status] || '#6b7280'} 0%, ${statusColors[entry.status] || '#6b7280'}dd 100%)`,
                              }}
                            >
                              {statusIcons[entry.status] || '📋'}
                            </div>
                            <div className="admin-timeline-content">
                              <div className="admin-timeline-status">{entry.status}</div>
                              {entry.message && <div className="admin-timeline-message">{entry.message}</div>}
                              <div className="admin-timeline-date">
                                {new Date(entry.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {order.estimatedDelivery && (
                    <div className="admin-order-card-eta">
                      <strong>Estimated Delivery:</strong> {order.estimatedDelivery}
                    </div>
                  )}
                  {returnsByOrder(order.orderId).length > 0 && (
                    <div style={{ marginTop: '1.2rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '1rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.7rem', color: '#92400e' }}>↩️ Return Requests ({returnsByOrder(order.orderId).length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {returnsByOrder(order.orderId).map((r) => (
                          <div key={r.id} style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 8, padding: '0.7rem 0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.82rem' }}><strong>{productName(r.productId)}</strong> • {r.reason}</span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e' }}>{r.status}{r.pickupDate ? ` • ${r.pickupDate}` : ''}</span>
                            </div>
                            {r.description && <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: 4 }}>{r.description}</div>}
                            {r.adminMessage && <div style={{ fontSize: '0.78rem', background: '#eff6ff', padding: '0.4rem 0.6rem', borderRadius: 6, color: '#1e40af', marginTop: 4 }}>Admin: {r.adminMessage}</div>}
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                              {r.status !== 'Rejected' && r.status !== 'Completed' && nextFor(r.status) && <button onClick={() => handleReturnStatus(r.id, nextFor(r.status))} style={{ padding: '0.3rem 0.7rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>→ {nextFor(r.status)}</button>}
                              {r.status === 'Pending' && <button onClick={() => handleReturnStatus(r.id, 'Rejected')} style={{ padding: '0.3rem 0.7rem', background: 'white', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>Reject</button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="admin-products-empty">
            <span className="admin-products-empty-icon">📦</span>
            <h3>No orders found</h3>
            <p>{search ? 'Try a different search term' : 'Orders will appear here when customers place them'}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {statusModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="admin-modal-overlay"
            onClick={() => setStatusModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="admin-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-modal-header">
                <h3>Update Order Status</h3>
                <button onClick={() => setStatusModal(null)} className="admin-modal-close">✕</button>
              </div>

              <div className="admin-modal-body">
                <div className="admin-order-modal-info">
                  Order: <strong>{statusModal.orderId}</strong> | Current: <strong style={{ color: statusColors[statusModal.currentStatus] }}>{statusModal.currentStatus}</strong>
                </div>

                <div className="admin-form-group">
                  <label>New Status</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    {allStatuses.map((s) => (
                      <option key={s} value={s}>{statusIcons[s]} {s}</option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-group">
                  <label>Status Message</label>
                  <input value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} placeholder={`e.g. Order has been ${newStatus.toLowerCase()}`} />
                </div>

                {newStatus === 'Dispatched' && (
                  <div className="admin-form-group" style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: 8, padding: '0.8rem' }}>
                    <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>📦 Tracking Link</label>
                    <input
                      value={trackingLink}
                      onChange={(e) => setTrackingLink(e.target.value)}
                      placeholder="e.g. https://www.dtdc.in/trackshipment..."
                      style={{ width: '100%' }}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#0369a1', marginTop: '0.4rem', marginBottom: 0 }}>
                      Customer will receive this link via WhatsApp & Email
                    </p>
                  </div>
                )}

                <div className="admin-form-group">
                  <label>Estimated Delivery</label>
                  <input value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} placeholder="e.g. 20 Aug 2026" />
                </div>

                <div className="admin-form-group">
                  <label>Order Notes</label>
                  <textarea rows={2} value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Internal notes about this order..." />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button onClick={() => setStatusModal(null)} className="admin-btn admin-btn-outline">Cancel</button>
                <button onClick={handleStatusUpdate} className="admin-btn admin-btn-primary">Update Status</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
