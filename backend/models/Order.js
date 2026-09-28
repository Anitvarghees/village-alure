import mongoose from 'mongoose';

const trackingSchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  message: { type: String, default: '' },
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  colorIndex: { type: Number, default: 0 },
  qty: { type: Number, default: 1 },
  cancelled: { type: Boolean, default: false },
  cancelReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  total: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
  },
  paymentId: {
    type: String,
    default: '',
  },
  payment: {
    type: String,
    default: 'COD',
  },
  date: {
    type: String,
    required: true,
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  address: {
    type: String,
    default: '',
  },
  city: {
    type: String,
    default: '',
  },
  state: {
    type: String,
    default: '',
  },
  pincode: {
    type: String,
    default: '',
  },
  deliveredAt: { type: Date, default: null },
  returnDeadline: { type: Date, default: null },
  tracking: [trackingSchema],
  estimatedDelivery: {
    type: String,
    default: '',
  },
  trackingLink: {
    type: String,
    default: '',
  },
  lastUpdated: {
    type: String,
    default: '',
  },
  notes: {
    type: String,
    default: '',
  },
}, { timestamps: true });

orderSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
  },
});

export default mongoose.model('Order', orderSchema);
