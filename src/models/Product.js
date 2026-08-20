const mongoose = require('mongoose');
const { getIsConnected, connectToDatabase } = require('../config/db');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    comparePrice: { type: Number, default: 0 },
    imageUrl: { type: String, default: '' },
    stock: { type: Number, default: 0 },
    size: {
      type: [String],
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

let ProductModel;
try {
  ProductModel = mongoose.model('Product');
} catch {
  ProductModel = mongoose.model('Product', productSchema);
}

let inMemoryProducts = [];
let productCounter = 1;

function sanitizeProduct(product) {
  return {
    id: product.id || product._id?.toString(),
    name: product.name,
    description: product.description,
    price: product.price,
    comparePrice: product.comparePrice || 0,
    imageUrl: product.imageUrl,
    stock: product.stock !== undefined ? product.stock : 0,
    size: Array.isArray(product.size) ? product.size : [product.size].filter(Boolean),
    createdAt: product.createdAt,
  };
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

async function ensureDbConnection() {
  if (!getIsConnected()) {
    await connectToDatabase();
  }
}

async function listProducts() {
  await ensureDbConnection();
  if (getIsConnected() && ProductModel) {
    const products = await ProductModel.find({}).sort({ createdAt: -1 }).lean();
    return products.map(sanitizeProduct);
  }
  return inMemoryProducts.map(sanitizeProduct);
}

async function createProduct(data) {
  await ensureDbConnection();
  const payload = {
    ...data,
    size: normalizeProductSize(data.size),
  };
  if (getIsConnected() && ProductModel) {
    const created = await ProductModel.create(payload);
    return sanitizeProduct(created.toObject());
  }
  const product = {
    id: `product_${productCounter++}`,
    ...payload,
    createdAt: new Date(),
  };
  inMemoryProducts.push(product);
  return sanitizeProduct(product);
}

async function getProductById(id) {
  await ensureDbConnection();
  if (getIsConnected() && ProductModel) {
    try {
      const product = await ProductModel.findOne({ _id: id }).lean();
      return product ? sanitizeProduct(product) : null;
    } catch {
      return null;
    }
  }
  return inMemoryProducts.find((p) => String(p.id) === String(id)) || null;
}

async function updateProduct(id, data) {
  await ensureDbConnection();
  const payload = { ...data };
  if (data.size !== undefined) {
    payload.size = normalizeProductSize(data.size);
  }
  if (getIsConnected() && ProductModel) {
    const product = await ProductModel.findByIdAndUpdate(id, payload, { new: true }).lean();
    return product ? sanitizeProduct(product) : null;
  }
  const index = inMemoryProducts.findIndex((p) => String(p.id) === String(id));
  if (index === -1) return null;
  inMemoryProducts[index] = { ...inMemoryProducts[index], ...payload };
  return sanitizeProduct(inMemoryProducts[index]);
}

async function deleteProduct(id) {
  await ensureDbConnection();
  if (getIsConnected() && ProductModel) {
    const product = await ProductModel.findByIdAndDelete(id).lean();
    return Boolean(product);
  }
  const index = inMemoryProducts.findIndex((p) => String(p.id) === String(id));
  if (index === -1) return false;
  inMemoryProducts.splice(index, 1);
  return true;
}

module.exports = {
  ProductModel,
  sanitizeProduct,
  normalizeProductSize,
  listProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
};
