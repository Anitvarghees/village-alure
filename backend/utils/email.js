import nodemailer from 'nodemailer';
import Product from '../models/Product.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP not configured - emails will not be sent. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

// Read lazily - server.js loads .env AFTER this module is imported, so a
// module-level constant would always miss SMTP_FROM/SMTP_USER.
function fromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@villageallure.com';
}

// Where a confirmation goes when the customer did not leave an email address.
function recipientFor(order) {
  return order.email || process.env.ORDER_NOTIFY_EMAIL || process.env.SMTP_USER || '';
}

// Store inbox (Village Allure) - always gets a copy of order + payment emails.
function storeAddress() {
  return process.env.ORDER_NOTIFY_EMAIL || process.env.SMTP_USER || '';
}

// Customer is the primary recipient, the store is bcc'd so the customer never
// sees the store address. When the customer left no email the store is already
// the primary recipient, so no bcc is needed (avoids a duplicate).
export function recipientsFor(order) {
  const customer = (order.email || '').trim();
  const store = storeAddress();
  if (customer && store && customer.toLowerCase() !== store.toLowerCase()) {
    return { to: customer, bcc: store };
  }
  return { to: customer || store, bcc: '' };
}

const inr = (n) => `&#8377;${Number(n || 0).toLocaleString('en-IN')}`;

const SITE_NAME = 'Village Allure';

export function confirmationHtml(order, items, note = '') {
  const rows = items.map((it) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${it.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${it.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;color:#666;">${it.price}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${it.lineTotal}</td>
    </tr>`).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f9f9f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#6b1e23,#8b3a42);padding:32px 24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">${SITE_NAME}</h1>
        <p style="color:#f0d0d3;margin:8px 0 0;font-size:14px;">Order Confirmation</p>
      </div>
      <div style="padding:32px 24px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:60px;height:60px;background:#10b981;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:28px;">&#10003;</span>
          </div>
          <h2 style="color:#333;margin:0 0 8px;">Thank you, ${order.name.split(' ')[0]}!</h2>
          <p style="color:#666;margin:0;">Your order has been placed successfully</p>
        </div>

        ${note ? `<div style="background:#fff7ed;border-radius:8px;padding:12px 16px;margin-bottom:20px;border-left:4px solid #f59e0b;">
          <p style="color:#9a3412;margin:0;font-size:13px;line-height:1.6;">${note}</p>
        </div>` : ''}

        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:4px 0;color:#666;font-size:14px;">Order ID</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#6b1e23;">${order.orderId}</td></tr>
            <tr><td style="padding:4px 0;color:#666;font-size:14px;">Date</td><td style="padding:4px 0;text-align:right;color:#333;">${order.date}</td></tr>
            <tr><td style="padding:4px 0;color:#666;font-size:14px;">Payment</td><td style="padding:4px 0;text-align:right;color:#333;">${order.payment}</td></tr>
            ${order.paymentId ? `<tr><td style="padding:4px 0;color:#666;font-size:14px;">Payment ID</td><td style="padding:4px 0;text-align:right;color:#333;font-size:13px;">${order.paymentId}</td></tr>` : ''}
            <tr><td style="padding:4px 0;color:#666;font-size:14px;">Payment Status</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#10b981;">${order.payment === 'COD' ? 'Due on delivery' : 'PAID'}</td></tr>
            <tr><td style="padding:4px 0;color:#666;font-size:14px;font-weight:600;">Total</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#6b1e23;font-size:18px;">&#8377;${order.total.toLocaleString('en-IN')}</td></tr>
          </table>
        </div>

        <h3 style="color:#333;margin:0 0 12px;font-size:16px;">Items Ordered</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <tr style="background:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;border-bottom:1px solid #eee;">Product</th>
            <th style="padding:10px 12px;text-align:center;font-size:13px;color:#666;border-bottom:1px solid #eee;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:13px;color:#666;border-bottom:1px solid #eee;">Price</th>
            <th style="padding:10px 12px;text-align:right;font-size:13px;color:#666;border-bottom:1px solid #eee;">Amount</th>
          </tr>
          ${rows}
        </table>

        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
          <h3 style="color:#333;margin:0 0 8px;font-size:14px;">Shipping Address</h3>
          <p style="color:#666;margin:0;font-size:14px;line-height:1.6;">
            ${order.name}<br>
            ${order.address || ''}<br>
            ${order.city || ''}, ${order.state || ''} - ${order.pincode || ''}
          </p>
        </div>

        <div style="background:#eff6ff;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #3b82f6;">
          <p style="color:#1e40af;margin:0;font-size:14px;line-height:1.6;">
            We will call you on <strong>${order.phone}</strong> to confirm delivery details.
            ${order.payment === 'COD' ? 'Payment will be collected on delivery.' : 'Your payment has been received. Thank you!'}
          </p>
        </div>

        <p style="color:#999;text-align:center;font-size:12px;margin:24px 0 0;">
          Questions? Reply to this email or contact us at ${fromAddress()}
        </p>
      </div>
      <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
        <p style="color:#999;margin:0;font-size:11px;">&copy; ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>`;
}

function statusUpdateHtml(order, status, message) {
  const statusColors = {
    'Pending': '#f59e0b', 'Processing': '#3b82f6', 'Dispatched': '#8b5cf6',
    'Shipped': '#6366f1', 'Out for Delivery': '#f97316', 'Delivered': '#10b981',
    'Cancelled': '#ef4444',
  };
  const color = statusColors[status] || '#6b7280';

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f9f9f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#6b1e23,#8b3a42);padding:32px 24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">${SITE_NAME}</h1>
        <p style="color:#f0d0d3;margin:8px 0 0;font-size:14px;">Order Update</p>
      </div>
      <div style="padding:32px 24px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:${color};color:white;padding:6px 20px;border-radius:20px;font-size:14px;font-weight:600;">${status}</div>
          <h2 style="color:#333;margin:16px 0 8px;">Order ${order.orderId}</h2>
          <p style="color:#666;margin:0;">Hi ${order.name.split(' ')[0]}, your order status has been updated.</p>
        </div>

        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="color:#333;margin:0;font-size:14px;line-height:1.6;">${message || `Your order has been ${status.toLowerCase()}.`}</p>
        </div>

        ${status === 'Dispatched' && order.trackingLink ? `
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${order.trackingLink}" style="display:inline-block;background:#6b1e23;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Track Your Order</a>
        </div>` : ''}

        <div style="background:#f9fafb;border-radius:8px;padding:16px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:4px 0;color:#666;font-size:14px;">Order ID</td><td style="padding:4px 0;text-align:right;font-weight:600;">${order.orderId}</td></tr>
            <tr><td style="padding:4px 0;color:#666;font-size:14px;">Status</td><td style="padding:4px 0;text-align:right;color:${color};font-weight:600;">${status}</td></tr>
          </table>
        </div>

        <p style="color:#999;text-align:center;font-size:12px;margin:24px 0 0;">
          Questions? Reply to this email or contact us at ${fromAddress()}
        </p>
      </div>
      <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
        <p style="color:#999;margin:0;font-size:11px;">&copy; ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>`;
}

export function paymentConfirmationHtml(order, items, note = '') {
  const rows = items.map((it) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${it.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${it.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;color:#666;">${it.price}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${it.lineTotal}</td>
    </tr>`).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f9f9f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:32px 24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">${SITE_NAME}</h1>
        <p style="color:#ccfbf1;margin:8px 0 0;font-size:14px;">Payment Confirmation</p>
      </div>
      <div style="padding:32px 24px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:60px;height:60px;background:#10b981;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:28px;">&#10003;</span>
          </div>
          <h2 style="color:#333;margin:0 0 8px;">Payment received</h2>
          <p style="color:#666;margin:0;">Thank you, ${((order.name || '').split(' ')[0]) || 'Customer'}! Your payment for order ${order.orderId} has been confirmed.</p>
        </div>

        ${note ? `<div style="background:#fff7ed;border-radius:8px;padding:12px 16px;margin-bottom:20px;border-left:4px solid #f59e0b;">
          <p style="color:#9a3412;margin:0;font-size:13px;line-height:1.6;">${note}</p>
        </div>` : ''}

        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:4px 0;color:#666;font-size:14px;">Order ID</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#0f766e;">${order.orderId}</td></tr>
            <tr><td style="padding:4px 0;color:#666;font-size:14px;">Date</td><td style="padding:4px 0;text-align:right;color:#333;">${order.date}</td></tr>
            <tr><td style="padding:4px 0;color:#666;font-size:14px;">Paid Via</td><td style="padding:4px 0;text-align:right;color:#333;">${order.payment}</td></tr>
            ${order.paymentId ? `<tr><td style="padding:4px 0;color:#666;font-size:14px;">Payment ID</td><td style="padding:4px 0;text-align:right;color:#333;font-size:13px;">${order.paymentId}</td></tr>` : ''}
            <tr><td style="padding:4px 0;color:#666;font-size:14px;">Payment Status</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#10b981;">&#10003; PAID</td></tr>
            <tr><td style="padding:4px 0;color:#666;font-size:14px;font-weight:600;">Amount Paid</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#0f766e;font-size:18px;">&#8377;${order.total.toLocaleString('en-IN')}</td></tr>
          </table>
        </div>

        <h3 style="color:#333;margin:0 0 12px;font-size:16px;">Items</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <tr style="background:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;border-bottom:1px solid #eee;">Product</th>
            <th style="padding:10px 12px;text-align:center;font-size:13px;color:#666;border-bottom:1px solid #eee;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:13px;color:#666;border-bottom:1px solid #eee;">Price</th>
            <th style="padding:10px 12px;text-align:right;font-size:13px;color:#666;border-bottom:1px solid #eee;">Amount</th>
          </tr>
          ${rows}
        </table>

        <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #10b981;">
          <p style="color:#065f46;margin:0;font-size:14px;line-height:1.6;font-weight:600;">Payment of &#8377;${order.total.toLocaleString('en-IN')} received successfully. Nothing is due for this order.</p>
        </div>

        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
          <h3 style="color:#333;margin:0 0 8px;font-size:14px;">Shipping Address</h3>
          <p style="color:#666;margin:0;font-size:14px;line-height:1.6;">
            ${order.name}<br>
            ${order.address || ''}<br>
            ${order.city || ''}, ${order.state || ''} - ${order.pincode || ''}
          </p>
        </div>

        <p style="color:#666;font-size:14px;line-height:1.6;margin:0;">
          We will call you on <strong>${order.phone}</strong> to confirm delivery details.
        </p>

        <p style="color:#999;text-align:center;font-size:12px;margin:24px 0 0;">
          Questions? Reply to this email or contact us at ${fromAddress()}
        </p>
      </div>
      <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
        <p style="color:#999;margin:0;font-size:11px;">&copy; ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>`;
}

const NO_CUSTOMER_EMAIL_NOTE = 'The customer did not provide an email address with this order, so this copy was sent to the store inbox instead.';

async function loadItems(order) {
  const productIds = order.items.map((item) => item.id);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = {};
  products.forEach((p) => { productMap[p._id] = p; });

  return order.items.map((item) => {
    const product = productMap[item.id];
    const qty = item.qty || 1;
    const price = product ? Number(product.price || 0) : 0;
    return {
      name: product ? product.name : item.id,
      qty,
      price: inr(price),
      lineTotal: inr(price * qty),
    };
  });
}

export async function sendOrderConfirmation(order) {
  const { to, bcc } = recipientsFor(order);
  if (!to) {
    console.log('No recipient available for confirmation email - set SMTP_USER or ORDER_NOTIFY_EMAIL');
    return;
  }

  const transport = getTransporter();
  if (!transport) return;

  const items = await loadItems(order);

  try {
    await transport.sendMail({
      from: `"${SITE_NAME}" <${fromAddress()}>`,
      to,
      ...(bcc ? { bcc } : {}),
      subject: `Order Successful - ${order.orderId}`,
      html: confirmationHtml(order, items, order.email ? '' : NO_CUSTOMER_EMAIL_NOTE),
    });
    console.log(`Confirmation email sent to ${to}${bcc ? ` (bcc ${bcc})` : ''} for order ${order.orderId}${order.email ? '' : ' (store inbox, no customer email)'}`);
  } catch (error) {
    console.error('Failed to send confirmation email:', error.message);
  }
}

export async function sendPaymentConfirmation(order) {
  if (!order.payment || order.payment === 'COD') return;

  const { to, bcc } = recipientsFor(order);
  if (!to) {
    console.log('No recipient available for payment confirmation email - set SMTP_USER or ORDER_NOTIFY_EMAIL');
    return;
  }

  const transport = getTransporter();
  if (!transport) return;

  const items = await loadItems(order);

  try {
    await transport.sendMail({
      from: `"${SITE_NAME}" <${fromAddress()}>`,
      to,
      ...(bcc ? { bcc } : {}),
      subject: `Payment Confirmed - ${order.orderId}`,
      html: paymentConfirmationHtml(order, items, order.email ? '' : NO_CUSTOMER_EMAIL_NOTE),
    });
    console.log(`Payment confirmation email sent to ${to}${bcc ? ` (bcc ${bcc})` : ''} for order ${order.orderId}${order.email ? '' : ' (store inbox, no customer email)'}`);
  } catch (error) {
    console.error('Failed to send payment confirmation email:', error.message);
  }
}

export async function sendOrderStatusUpdate(order, status, message) {
  const to = recipientFor(order);
  if (!to) {
    console.log('No recipient available for status update email - set SMTP_USER or ORDER_NOTIFY_EMAIL');
    return;
  }

  const transport = getTransporter();
  if (!transport) return;

  try {
    await transport.sendMail({
      from: `"${SITE_NAME}" <${fromAddress()}>`,
      to,
      subject: `Order ${order.orderId} - ${status}`,
      html: statusUpdateHtml(order, status, message),
    });
    console.log(`Status update email sent to ${to} for order ${order.orderId} - ${status}`);
  } catch (error) {
    console.error('Failed to send status update email:', error.message);
  }
}
