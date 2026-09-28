import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const router = express.Router();

let razorpay = null;

function getRazorpay() {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('Payment gateway not configured. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set.');
    }
    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpay;
}

router.get('/test', async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return res.json({ ok: false, error: 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing from env' });
    }
    const instance = getRazorpay();
    const order = await instance.orders.create({ amount: 100, currency: 'INR', receipt: 'test_receipt' });
    res.json({ ok: true, orderId: order.id, keyPrefix: keyId.substring(0, 12) });
  } catch (error) {
    res.json({ ok: false, error: error?.error?.description || error?.message || String(error) });
  }
});

router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Amount must be at least 100 paise (₹1)' });
    }

    let instance;
    try {
      instance = getRazorpay();
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }

    const order = await instance.orders.create({
      amount: Math.round(amount),
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('Razorpay create order error:', error?.statusCode, error?.error?.description || error?.message || error);
    const message = error?.error?.description || error?.message || 'Failed to create payment order';
    res.status(error?.statusCode || 500).json({ error: message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    res.json({ verified: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id });
  } catch (error) {
    console.error('Razorpay verify error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

export default router;
