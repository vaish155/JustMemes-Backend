const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Razorpay = require('razorpay');

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const mongoUri = process.env.MONGODB_URI;
const useMongo = Boolean(mongoUri);

// -----------------------------
// 1. Server setup
// -----------------------------
app.use(cors());
app.use(express.json());

// -----------------------------
// 2. MongoDB schemas
// -----------------------------
const availableSizes = ['xs', 's', 'm', 'l', 'xl'];

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    imageUrl: { type: String, default: '' },
    stock: { type: Number, default: 0 },
    size: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => value.every((entry) => availableSizes.includes(entry)),
        message: 'Each size must be one of xs, s, m, l, xl.'
      }
    },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

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
        price: { type: Number, required: true }
      }
    ],
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    paymentStatus: { type: String, default: 'pending' },
    orderStatus: { type: String, default: 'placed' },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// -----------------------------
// 3. Runtime state and storage
// -----------------------------
let ProductModel;
let OrderModel;
let inMemoryOrders = [];
let orderCounter = 1;

// -----------------------------
// 4. Database connection helpers
// -----------------------------
async function connectToDatabase() {
  if (!useMongo) {
    console.error('MONGODB_URI is not set. Product routes require a database connection.');
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    ProductModel = mongoose.model('Product', productSchema);
    OrderModel = mongoose.model('Order', orderSchema);
    console.log('MongoDB connected');
    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    ProductModel = null;
    OrderModel = null;
    return false;
  }
}

// -----------------------------
// 5. Data sanitizers
// -----------------------------
function sanitizeProduct(product) {
  return {
    id: product.id || product._id?.toString(),
    name: product.name,
    description: product.description,
    price: product.price,
    imageUrl: product.imageUrl,
    stock: product.stock,
    size: Array.isArray(product.size) ? product.size : [product.size].filter(Boolean),
    createdAt: product.createdAt
  };
}

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
    createdAt: order.createdAt
  };
}

// -----------------------------
// 6. Product helper functions
// -----------------------------
async function listProducts() {
  if (!ProductModel) {
    throw new Error('Product store is not available. Please ensure MongoDB is connected.');
  }

  const products = await ProductModel.find({}).sort({ createdAt: -1 }).lean();
  return products.map(sanitizeProduct);
}

function normalizeProductSize(size) {
  if (Array.isArray(size)) {
    return size.filter(Boolean);
  }

  if (typeof size === 'string' && size) {
    return [size];
  }

  return [];
}

async function createProduct(data) {
  if (!ProductModel) {
    throw new Error('Product store is not available. Please ensure MongoDB is connected.');
  }

  const payload = {
    ...data,
    size: normalizeProductSize(data.size)
  };

  const created = await ProductModel.create(payload);
  return sanitizeProduct(created.toObject());
}

async function getProductById(id) {
  if (!ProductModel) {
    throw new Error('Product store is not available. Please ensure MongoDB is connected.');
  }

  const product = await ProductModel.findOne({ _id: id }).lean();
  return product ? sanitizeProduct(product) : null;
}

async function updateProduct(id, data) {
  if (!ProductModel) {
    throw new Error('Product store is not available. Please ensure MongoDB is connected.');
  }

  const payload = {
    ...data,
    size: data.size !== undefined ? normalizeProductSize(data.size) : undefined
  };

  const product = await ProductModel.findByIdAndUpdate(id, payload, { new: true }).lean();
  return product ? sanitizeProduct(product) : null;
}

async function deleteProduct(id) {
  if (!ProductModel) {
    throw new Error('Product store is not available. Please ensure MongoDB is connected.');
  }

  const product = await ProductModel.findByIdAndDelete(id).lean();
  return Boolean(product);
}

// -----------------------------
// 7. Order helper functions
// -----------------------------
async function createOrder(data) {
  // Creates a checkout order from the submitted customer and item details.
  if (OrderModel) {
    const created = await OrderModel.create(data);
    return sanitizeOrder(created.toObject());
  }

  const order = {
    id: `order_${orderCounter++}`,
    ...data,
    paymentStatus: 'pending',
    orderStatus: 'placed'
  };
  inMemoryOrders.push(order);
  return sanitizeOrder(order);
}

async function listOrders() {
  // Returns all orders for admin/debug purposes.
  if (OrderModel) {
    const orders = await OrderModel.find({}).sort({ createdAt: -1 }).lean();
    return orders.map(sanitizeOrder);
  }

  return inMemoryOrders.map(sanitizeOrder);
}

async function getOrderById(id) {
  // Finds a single order by its id.
  if (OrderModel) {
    const order = await OrderModel.findOne({ _id: id }).lean();
    return order ? sanitizeOrder(order) : null;
  }

  return inMemoryOrders.find((order) => order.id === id) || null;
}

async function updateOrder(id, updates) {
  // Updates order payment or status information.
  if (OrderModel) {
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

// -----------------------------
// 8. Razorpay helper functions
// -----------------------------
function createRazorpayInstance() {
  // Creates a Razorpay client if API keys are configured.
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

async function createRazorpayOrderPayload(order, amount) {
  // Creates a Razorpay order payload for the frontend payment flow.
  const instance = createRazorpayInstance();
  if (!instance) {
    return {
      mock: true,
      id: `mock_order_${Date.now()}`,
      amount,
      currency: 'INR',
      receipt: order.id,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock'
    };
  }

  return instance.orders.create({
    amount,
    currency: 'INR',
    receipt: order.id
  });
}

// -----------------------------
// 9. API routes
// -----------------------------
// Health check endpoint for uptime monitoring.
app.get('/ping', (_req, res) => {
  res.status(200).json({
    ok: true,
    message: 'pong',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Root endpoint for a quick sanity check.
app.get('/', (_req, res) => {
  res.send('JustMemes ecommerce backend is running');
});

// GET /products - returns all products.
app.get('/products', async (_req, res) => {
  try {
    const products = await listProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /products/:id - returns one product by id.
app.get('/products/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /products - creates a new product.
app.post('/products', async (req, res) => {
  try {
    const product = await createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /products/:id - updates an existing product.
app.put('/products/:id', async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /products/:id - removes a product.
app.delete('/products/:id', async (req, res) => {
  try {
    const deleted = await deleteProduct(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /checkout - creates an order from customer details and selected items.
app.post('/checkout', async (req, res) => {
  try {
    const { customerName, contact, email, address, roomNumber, hostelName, items } = req.body;

    if (!customerName || !contact || !email || !address || !roomNumber || !hostelName || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Please provide customer details and at least one item.' });
    }

    const productDetails = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await getProductById(item.productId);
      if (!product) {
        return res.status(404).json({ error: `Product not found: ${item.productId}` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      const selectedSize = item.size;
      const availableSizes = Array.isArray(product.size) ? product.size : [product.size].filter(Boolean);
      if (!selectedSize || !availableSizes.includes(selectedSize)) {
        return res.status(400).json({ error: `Selected size ${selectedSize || 'none'} is not available for ${product.name}` });
      }

      subtotal += product.price * item.quantity;
      productDetails.push({
        productId: product.id,
        productName: product.name,
        size: selectedSize,
        quantity: item.quantity,
        price: product.price
      });
    }

    const total = subtotal;

    const order = await createOrder({
      customerName,
      contact,
      email,
      address,
      roomNumber,
      hostelName,
      items: productDetails,
      subtotal,
      total
    });

    res.status(201).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /orders - returns all placed orders.
app.get('/orders', async (_req, res) => {
  try {
    const orders = await listOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /orders/:id - returns a single order.
app.get('/orders/:id', async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /payments/create-order - prepares a Razorpay order payload for the frontend.
app.post('/payments/create-order', async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const payload = await createRazorpayOrderPayload(order, amount || Math.round(order.total * 100));
    const updatedOrder = await updateOrder(order.id, { razorpayOrderId: payload.id });
    res.json({ success: true, order: updatedOrder, razorpay: payload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /payments/verify - verifies the Razorpay signature after payment.
app.post('/payments/verify', async (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test_secret')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;
    const updatedOrder = await updateOrder(order.id, {
      paymentStatus: isValid ? 'paid' : 'failed',
      orderStatus: isValid ? 'paid' : 'failed',
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature
    });

    res.json({ success: true, valid: isValid, order: updatedOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------
// 10. Server startup
// -----------------------------
function startServer() {
  const server = app.listen(port, host, async () => {
    await connectToDatabase();
    server.emit('ready');
    console.log(`Server running on http://${host}:${port}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
