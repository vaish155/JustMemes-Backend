const mongoose = require('mongoose');
const { getIsConnected } = require('../config/db');

const orderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true },
    contact: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    roomNumber: { type: String, required: true },
    hostelName: { type: String, required: true },
    items: [
      {
        productId: { type: String, required: true },
        productName: { type: String, required: true },
        size: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    paymentStatus: { type: String, default: 'pending' },
    orderStatus: { type: String, default: 'placed' },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

let OrderModel;
try {
  OrderModel = mongoose.model('Order');
} catch {
  OrderModel = mongoose.model('Order', orderSchema);
}

let inMemoryOrders = [];
let orderCounter = 1;

function sanitizeOrder(order) {
  return {
    id: order.id || order._id?.toString(),
    customerName: order.customerName,
    contact: order.contact,
    email: order.email,
    address: order.address,
    roomNumber: order.roomNumber,
    hostelName: order.hostelName,
    items: order.items,
    subtotal: order.subtotal,
    total: order.total,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: order.razorpayPaymentId,
    razorpaySignature: order.razorpaySignature,
    createdAt: order.createdAt,
  };
}

async function createOrder(data) {
  if (getIsConnected() && OrderModel) {
    const created = await OrderModel.create(data);
    return sanitizeOrder(created.toObject());
  }

  const order = {
    id: `order_${orderCounter++}`,
    ...data,
    paymentStatus: 'pending',
    orderStatus: 'placed',
    createdAt: new Date(),
  };
  inMemoryOrders.push(order);
  return sanitizeOrder(order);
}

async function listOrders() {
  if (getIsConnected() && OrderModel) {
    const orders = await OrderModel.find({}).sort({ createdAt: -1 }).lean();
    return orders.map(sanitizeOrder);
  }
  return inMemoryOrders.map(sanitizeOrder);
}

async function getOrderById(id) {
  if (getIsConnected() && OrderModel) {
    const order = await OrderModel.findOne({ _id: id }).lean();
    return order ? sanitizeOrder(order) : null;
  }
  return inMemoryOrders.find((order) => order.id === id) || null;
}

async function updateOrder(id, updates) {
  if (getIsConnected() && OrderModel) {
    const order = await OrderModel.findByIdAndUpdate(id, updates, { new: true }).lean();
    return order ? sanitizeOrder(order) : null;
  }

  const index = inMemoryOrders.findIndex((order) => order.id === id);
  if (index === -1) {
    return null;
  }

  inMemoryOrders[index] = { ...inMemoryOrders[index], ...updates };
  return sanitizeOrder(inMemoryOrders[index]);
}

module.exports = {
  OrderModel,
  sanitizeOrder,
  createOrder,
  listOrders,
  getOrderById,
  updateOrder,
};
