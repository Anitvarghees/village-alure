import Product from '../models/Product.js';

const MSG91_API = 'https://api.msg91.com/api/v5/flow';

function cleanPhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

export async function sendOrderConfirmationSMS(order) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID || 'VILALL';
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    console.warn('MSG91 not configured — skipping SMS. Set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID in .env');
    return;
  }

  const phone = cleanPhone(order.phone);
  if (!phone || phone.length < 12) {
    console.log('Invalid phone number, skipping SMS:', order.phone);
    return;
  }

  const productIds = order.items.map((item) => item.id);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = {};
  products.forEach((p) => { productMap[p._id] = p; });

  const itemList = order.items.map((item) => {
    const product = productMap[item.id];
    const name = product ? product.name : item.id;
    return `${name} x${item.qty || 1}`;
  }).join(', ');

  const isPaid = !!order.payment && order.payment !== 'COD';

  const variables = {
    name: (order.name || '').split(' ')[0] || 'Customer',
    firstName: (order.name || '').split(' ')[0] || 'Customer',
    orderId: order.orderId,
    order_id: order.orderId,
    total: `₹${order.total.toLocaleString('en-IN')}`,
    amount: `₹${order.total.toLocaleString('en-IN')}`,
    items: itemList,
    itemList,
    phone: order.phone,
    payment: order.payment,
    paymentMethod: order.payment,
    paymentStatus: isPaid ? 'Paid' : 'Due on delivery',
    paymentId: order.paymentId || '',
    status: 'Order Successful',
  };

  try {
    const response = await fetch(MSG91_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify({
        flow_id: templateId,
        recipients: [{ mobiles: phone, ...variables }],
        sender: senderId,
      }),
    });

    const data = await response.json();
    if (response.ok && (data.type === 'success' || data.status === 'success' || !data.type)) {
      console.log(`SMS sent to ${order.phone} for order ${order.orderId}`);
    } else {
      console.error('MSG91 SMS error:', JSON.stringify(data));
    }
  } catch (error) {
    console.error('Failed to send SMS:', error.message);
  }
}
