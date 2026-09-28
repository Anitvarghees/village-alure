// Live check for order notifications: Email (SMTP), SMS (MSG91), WhatsApp (Meta).
// Usage:
//   node test-notify.js                 -> uses your own store numbers
//   node test-notify.js 9876543210      -> also sends to this customer number
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Product from './models/Product.js';
import { sendOrderConfirmation, sendPaymentConfirmation } from './utils/email.js';
import { sendOrderConfirmationSMS } from './utils/sms.js';
import { sendOrderWhatsApp } from './utils/whatsapp.js';

const phoneArg = (process.argv[2] || '').replace(/\D/g, '');
const customerPhone = phoneArg.length === 10 ? phoneArg : (process.env.TEST_CUSTOMER_PHONE || '9876543210');

const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;
const warn = (s) => `\x1b[33m${s}\x1b[0m`;

console.log('\n=== Village Allure notification check ===\n');
console.log('Customer phone for SMS / WhatsApp:', customerPhone);

const missing = [];
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) missing.push('SMTP_*');
if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_TEMPLATE_ID) missing.push('MSG91_AUTH_KEY / MSG91_TEMPLATE_ID');
if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) missing.push('WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID');
if (!process.env.WHATSAPP_TEMPLATE_NAME) warn('WHATSAPP_TEMPLATE_NAME is empty - messages go as free-form text (only delivered inside the 24h window).');
if (missing.length) warn(`Not configured: ${missing.join(', ')}\n`);

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const product = await Product.findOne({ quantity: { $gt: 0 } }).lean();
if (!product) {
  console.error(bad('No product with stock found in the database.'));
  process.exit(1);
}

const order = {
  orderId: `RS-TEST${Date.now().toString().slice(-6)}`,
  name: 'Test Customer',
  email: process.env.ORDER_NOTIFY_EMAIL || process.env.SMTP_USER,
  phone: customerPhone,
  payment: 'Paid via Razorpay',
  paymentId: 'pay_TEST000001',
  total: product.price || 999,
  date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
  address: 'Test address', city: 'Delhi', state: 'Delhi', pincode: '110001',
  status: 'Pending',
  items: [{ id: String(product._id), colorIndex: 0, qty: 1 }],
};

console.log(`\n[1/3] EMAIL  -> ${order.email}`);
try {
  await sendOrderConfirmation(order);
  await sendPaymentConfirmation(order);
  console.log(ok('  PASS  order + payment emails accepted by the SMTP server'));
} catch (e) {
  console.log(bad('  FAIL '), e.message);
}

console.log(`\n[2/3] SMS (MSG91) -> ${order.phone}`);
try {
  const hadKey = Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID);
  await sendOrderConfirmationSMS(order);
  console.log(hadKey ? ok('  PASS  MSG91 accepted the request (check the phone)') : warn('  SKIP  MSG91_AUTH_KEY / MSG91_TEMPLATE_ID missing'));
} catch (e) {
  console.log(bad('  FAIL '), e.message);
}

console.log(`\n[3/3] WHATSAPP (Meta) -> business ${process.env.WHATSAPP_BUSINESS_NUMBER || '916282655422'} + customer ${order.phone}`);
try {
  const res = await sendOrderWhatsApp(order);
  if (!res.configured) {
    console.log(warn('  SKIP  WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing'));
  } else {
    console.log(ok(`  sent  : ${res.sentTo.join(', ') || '(none)'}`));
    if (res.failed.length) console.log(bad(`  failed: ${res.failed.join(', ')}`), res.errors);
    console.log(`  fallback link (always works, needs one tap): ${res.customerUrl || res.businessUrl}`);
  }
} catch (e) {
  console.log(bad('  FAIL '), e.message);
}

await mongoose.disconnect();
console.log('\n=== done ===\n');
