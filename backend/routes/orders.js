import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';
import { sendOrderConfirmation, sendOrderStatusUpdate, sendPaymentConfirmation } from '../utils/email.js';
import { sendOrderConfirmationSMS } from '../utils/sms.js';
import { sendOrderWhatsApp, sendOrderStatusWhatsApp } from '../utils/whatsapp.js';

const router = express.Router();

function generateOrderId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'RS-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

router.get('/track/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({
      orderId: order.orderId,
      status: order.status,
      tracking: order.tracking,
      estimatedDelivery: order.estimatedDelivery,
      lastUpdated: order.lastUpdated,
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ error: 'Failed to track order' });
  }
});

router.get('/user/:phone', async (req, res) => {
  try {
    const orders = await Order.find({ phone: req.params.phone }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.put('/cancel/:orderId', async (req, res) => {
  try {
    const { phone, reason, productId } = req.body;
    const oid = String(req.params.orderId || '').trim().toUpperCase();
    const order = await Order.findOne({ orderId: oid }) || await Order.findOne({ orderId: String(req.params.orderId).trim() });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(phone).replace(/[^0-9]/g, '') !== String(order.phone).replace(/[^0-9]/g, '')) return res.status(403).json({ error: 'Phone does not match order' });
    if (['Delivered', 'Cancelled'].includes(order.status) && !productId) return res.status(400).json({ error: `Cannot cancel ${order.status} order` });

    if (productId) {
      const item = order.items.find((i) => i.id === productId && !i.cancelled);
      if (!item) return res.status(400).json({ error: 'Product not found or already cancelled' });
      item.cancelled = true;
      item.cancelReason = reason || 'Cancelled by customer';
      item.cancelledAt = new Date();

      // Restore quantity
      try {
        const product = await Product.findById(productId);
        if (product) {
          product.quantity = (product.quantity || 0) + (item.qty || 1);
          await product.save();
        }
      } catch (_) {}

      const activeItems = order.items.filter((i) => !i.cancelled);
      if (activeItems.length === 0) {
        order.status = 'Cancelled';
        order.notes = 'All items cancelled by customer';
      }
      order.lastUpdated = new Date().toISOString();
      order.tracking.push({ status: 'Cancelled', timestamp: new Date(), message: `Product ${productId} cancelled: ${reason || 'by customer'}` });
      await order.save();
      try { await Notification.create({ type: 'cancellation', title: 'Product Cancelled', message: `Customer ${order.name} cancelled product ${productId} from order ${order.orderId}. Reason: ${reason || 'N/A'}`, orderId: order.orderId, productId, phone: order.phone }); } catch (_) {}
      if (order.status === 'Cancelled') {
        sendOrderStatusWhatsApp(order, 'Cancelled', order.notes).catch((err) => console.error('WhatsApp status send failed:', err.message));
      }
      res.json(order);
    } else {
      order.status = 'Cancelled';
      order.notes = reason ? `Cancelled by customer: ${reason}` : 'Cancelled by customer';
      order.lastUpdated = new Date().toISOString();
      order.tracking.push({ status: 'Cancelled', timestamp: new Date(), message: reason ? `Cancelled: ${reason}` : 'Order cancelled by customer' });

      // Restore quantity for all non-cancelled items
      try {
        for (const item of order.items) {
          if (!item.cancelled) {
            const product = await Product.findById(item.id);
            if (product) {
              product.quantity = (product.quantity || 0) + (item.qty || 1);
              await product.save();
            }
          }
        }
      } catch (_) {}

      await order.save();
      try { await Notification.create({ type: 'cancellation', title: 'Order Cancelled', message: `Customer ${order.name} cancelled entire order ${order.orderId}. Reason: ${reason || 'N/A'}`, orderId: order.orderId, phone: order.phone }); } catch (_) {}
      sendOrderStatusWhatsApp(order, 'Cancelled', order.notes).catch((err) => console.error('WhatsApp status send failed:', err.message));
      res.json(order);
    }
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { items } = req.body;

    // Validate stock availability and decrease quantity
    if (items && items.length > 0) {
      for (const item of items) {
        const product = await Product.findById(item.id);
        if (product) {
          const currentQty = product.quantity || 0;
          if (currentQty > 0 && currentQty < item.qty) {
            return res.status(400).json({ error: `Not enough stock for "${product.name}". Only ${currentQty} pieces available.` });
          }
          if (currentQty > 0) {
            product.quantity = Math.max(0, currentQty - item.qty);
            await product.save();
          }
        }
      }
    }

    const orderData = {
      ...req.body,
      orderId: generateOrderId(),
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'Pending',
      tracking: [{
        status: 'Pending',
        timestamp: new Date(),
        message: 'Order placed successfully',
      }],
    };

    const order = new Order(orderData);
    await order.save();

    sendOrderConfirmation(order).catch((err) => console.error('Email send failed:', err.message));
    sendPaymentConfirmation(order).catch((err) => console.error('Payment email send failed:', err.message));
    sendOrderConfirmationSMS(order).catch((err) => console.error('SMS send failed:', err.message));
    sendOrderWhatsApp(order).catch((err) => console.error('WhatsApp send failed:', err.message));

    const productIds = order.items.map((item) => item.id);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = {};
    products.forEach((p) => { productMap[p._id] = p; });

    const itemList = order.items.map((item) => {
      const product = productMap[item.id];
      const name = product ? product.name : item.id;
      return `${name} x${item.qty || 1}`;
    }).join(', ');

    const addressLine = [order.address, order.city, order.state, order.pincode].filter(Boolean).join(', ');
    const waMsg = encodeURIComponent(
      `Hi Village Allure,\n\nOrder Details:\nOrder ID: ${order.orderId}\nItems: ${itemList}\nTotal: ₹${order.total.toLocaleString('en-IN')}\nPayment: ${order.payment}\n\nShipping To:\n${order.name}\n${addressLine}\nPhone: ${order.phone}\n\nPlease confirm my order. Thank you!`
    );
    const phone = (order.phone || '').replace(/\D/g, '');
    const whatsappUrl = phone ? `https://wa.me/91${phone}?text=${waMsg}` : '';

    res.status(201).json({ ...order.toJSON(), whatsappUrl });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, message, estimatedDelivery, notes, trackingLink } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.status = status;
    if (notes !== undefined) order.notes = notes;
    if (estimatedDelivery !== undefined) order.estimatedDelivery = estimatedDelivery;
    if (trackingLink !== undefined) order.trackingLink = trackingLink;
    order.lastUpdated = new Date().toISOString();
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
      const existing = order.returnDeadline ? new Date(order.returnDeadline) : null;
      if (!existing) {
        const deadline = new Date(order.deliveredAt.getTime() + 7*24*60*60*1000);
        order.returnDeadline = deadline;
      }
    }

    const trackingMsg = status === 'Dispatched' && trackingLink
      ? `Your order ${order.orderId} has been dispatched! Track it here: ${trackingLink}`
      : message || `Status updated to ${status}`;

    order.tracking.push({
      status,
      timestamp: new Date(),
      message: trackingMsg,
    });

    await order.save();

    const statusMessage = message || `Status updated to ${status}`;
    sendOrderStatusUpdate(order, status, statusMessage).catch(() => {});
    sendOrderStatusWhatsApp(order, status, statusMessage).catch((err) => console.error('WhatsApp status send failed:', err.message));

    if (status === 'Dispatched') {
      const notifMsg = `Order ${order.orderId} dispatched for ${order.name}. Phone: ${order.phone}${order.email ? ', Email: ' + order.email : ''}. Tracking: ${trackingLink || 'N/A'}`;
      await Notification.create({
        type: 'order',
        title: 'Order Dispatched',
        message: notifMsg,
        orderId: order.orderId,
        phone: order.phone,
      });

      const whatsappMsg = encodeURIComponent(`Hi ${order.name}, your order ${order.orderId} has been dispatched! Track your shipment here: ${trackingLink || 'Tracking link will be updated soon.'}`);
      const whatsappUrl = order.phone ? `https://wa.me/91${order.phone.replace(/\D/g, '')}?text=${whatsappMsg}` : '';

      const emailSubject = encodeURIComponent(`Your Order ${order.orderId} has been Dispatched!`);
      const emailBody = encodeURIComponent(`Hi ${order.name},\n\nYour order ${order.orderId} has been dispatched!\n\nTrack your shipment here: ${trackingLink || 'Tracking link will be updated soon.'}\n\nThank you for shopping with Village Allure!`);
      const emailUrl = order.email ? `mailto:${order.email}?subject=${emailSubject}&body=${emailBody}` : '';

      return res.json({ order, whatsappUrl, emailUrl });
    }

    res.json(order);
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    let order = null;
    try { order = await Order.findByIdAndDelete(req.params.id); } catch (_) {}
    if (!order) order = await Order.findOneAndDelete({ orderId: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found: ' + req.params.id });
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

export default router;
