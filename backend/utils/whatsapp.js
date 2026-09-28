import Product from '../models/Product.js';

const GRAPH_API = 'https://graph.facebook.com/v21.0';
const DEFAULT_BUSINESS_NUMBER = '916282655422';

function cleanPhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

function isConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function buildOrderDetails(order) {
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
  const total = `₹${order.total.toLocaleString('en-IN')}`;

  return { itemList, addressLine, total };
}

export async function buildBusinessMessage(order, details) {
  const { itemList, addressLine, total } = details || await buildOrderDetails(order);

  return [
    'New Order Received - Booking Confirmed',
    '',
    `Order ID: ${order.orderId}`,
    `Date: ${order.date || ''}`,
    `Status: ${order.status}`,
    '',
    `Customer: ${order.name}`,
    `Phone: ${order.phone}`,
    order.email ? `Email: ${order.email}` : null,
    '',
    `Items: ${itemList}`,
    `Total: ${total}`,
    `Payment: ${order.payment}`,
    '',
    'Shipping To:',
    addressLine,
  ].filter((line) => line !== null).join('\n');
}

export async function buildCustomerMessage(order, details) {
  const { itemList, addressLine, total } = details || await buildOrderDetails(order);
  const firstName = (order.name || '').split(' ')[0];

  return [
    `Hi ${firstName},`,
    '',
    'Thank you for your order! Your booking is confirmed.',
    '',
    `Order ID: ${order.orderId}`,
    `Items: ${itemList}`,
    `Total: ${total}`,
    `Payment: ${order.payment}`,
    '',
    'Shipping To:',
    `${order.name}`,
    addressLine,
    `Phone: ${order.phone}`,
    '',
    'We will notify you once your order is dispatched.',
    '- Village Allure',
  ].join('\n');
}

async function graphSend(payload) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const response = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = data?.error || {};
    const msg = err.message || `WhatsApp API error ${response.status}`;
    const detail = [err.code, err.error_subcode, err.type].filter(Boolean).join('/');
    throw new Error(detail ? `${msg} (${detail})` : msg);
  }
  return data;
}

// Values substituted into the approved Meta template, in this exact order:
//   {{1}} first name   {{2}} order id   {{3}} items   {{4}} total
//   {{5}} payment      {{6}} status     {{7}} note
// Set WHATSAPP_TEMPLATE_PARAM_COUNT if your template has a different number
// of {{n}} placeholders (Meta rejects the message when the counts differ).
const TEMPLATE_FIELDS = ['firstName', 'orderId', 'items', 'total', 'payment', 'status', 'note'];

export function buildTemplateParams(order, extra = {}) {
  const values = {
    firstName: (order.name || '').split(' ')[0] || 'Customer',
    orderId: order.orderId || '-',
    items: extra.items || '-',
    total: `₹${(order.total || 0).toLocaleString('en-IN')}`,
    payment: order.payment || '-',
    status: extra.status || order.status || '-',
    note: String(extra.note || '').replace(/\s+/g, ' ').trim() || '-',
  };

  const count = parseInt(process.env.WHATSAPP_TEMPLATE_PARAM_COUNT || '', 10) || TEMPLATE_FIELDS.length;
  const list = TEMPLATE_FIELDS.slice(0, Math.max(count, 0)).map((key) => String(values[key]));
  while (list.length < count) list.push('-');

  return list.map((text) => ({ type: 'text', text }));
}

async function sendText(to, body, params = []) {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

  // Business-initiated messages outside the 24h window need an approved template.
  if (templateName) {
    return graphSend({
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
        components: [{ type: 'body', parameters: params }],
      },
    });
  }

  return graphSend({
    to,
    type: 'text',
    text: { preview_url: false, body },
  });
}

function waMeUrl(phone, message) {
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';
}

async function deliver(order, businessMessage, customerMessage, params = []) {
  const businessNumber = cleanPhone(process.env.WHATSAPP_BUSINESS_NUMBER || DEFAULT_BUSINESS_NUMBER);
  const customerNumber = cleanPhone(order.phone);

  const result = {
    configured: isConfigured(),
    template: process.env.WHATSAPP_TEMPLATE_NAME || '',
    businessNumber,
    customerNumber,
    businessUrl: waMeUrl(businessNumber, businessMessage),
    customerUrl: customerMessage ? waMeUrl(customerNumber, customerMessage) : '',
    sentTo: [],
    failed: [],
    errors: {},
  };

  if (!isConfigured()) {
    console.warn('WhatsApp not configured - set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in backend/.env');
    return result;
  }

  const targets = [];
  if (businessNumber) targets.push({ label: 'business', to: businessNumber, message: businessMessage });
  if (customerNumber && customerNumber.length === 12 && customerMessage) {
    targets.push({ label: 'customer', to: customerNumber, message: customerMessage });
  }

  for (const target of targets) {
    try {
      await sendText(target.to, target.message, params);
      result.sentTo.push(target.label);
      console.log(`WhatsApp sent to ${target.label} (${target.to}) for order ${order.orderId}`);
    } catch (error) {
      result.failed.push(target.label);
      result.errors[target.label] = error.message;
      console.error(`WhatsApp send failed for ${target.label} (${target.to}):`, error.message);
    }
  }

  return result;
}

export async function sendOrderWhatsApp(order) {
  const details = await buildOrderDetails(order);
  const params = buildTemplateParams(order, { items: details.itemList, status: 'Order Successful' });

  const [businessMessage, customerMessage] = await Promise.all([
    buildBusinessMessage(order, details),
    buildCustomerMessage(order, details),
  ]);
  return deliver(order, businessMessage, customerMessage, params);
}

export async function sendOrderStatusWhatsApp(order, status, message) {
  const details = await buildOrderDetails(order);
  const params = buildTemplateParams(order, { items: details.itemList, status, note: message });
  const { itemList, addressLine, total } = details;

  const businessMessage = [
    'Order Status Update',
    '',
    `Order ID: ${order.orderId}`,
    `Status: ${status}`,
    `Date: ${order.date || ''}`,
    '',
    `Customer: ${order.name}`,
    `Phone: ${order.phone}`,
    '',
    `Items: ${itemList}`,
    `Total: ${total}`,
    `Payment: ${order.payment}`,
    addressLine ? `Address: ${addressLine}` : null,
    message ? `Note: ${message}` : null,
  ].filter((line) => line !== null).join('\n');

  // Business only - customer already gets status email + the dispatch wa.me link from the admin panel.
  return deliver(order, businessMessage, '', params);
}
