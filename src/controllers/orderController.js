const { getProductById } = require('../models/Product');
const { createOrder, listOrders, getOrderById } = require('../models/Order');

async function handleCheckout(req, res, next) {
  try {
    const { customerName, contact, email, address, roomNumber, hostelName, items } = req.body;

    if (
      !customerName ||
      !contact ||
      !email ||
      !address ||
      !roomNumber ||
      !hostelName ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res
        .status(400)
        .json({ error: 'Please provide customer details and at least one item.' });
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
      const availableSizes = Array.isArray(product.size)
        ? product.size
        : [product.size].filter(Boolean);

      if (!selectedSize || !availableSizes.includes(selectedSize)) {
        return res.status(400).json({
          error: `Selected size ${selectedSize || 'none'} is not available for ${product.name}`,
        });
      }

      subtotal += product.price * item.quantity;
      productDetails.push({
        productId: product.id,
        productName: product.name,
        size: selectedSize,
        quantity: item.quantity,
        price: product.price,
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
      total,
    });

    res.status(201).json({ success: true, order });
  } catch (error) {
    next(error);
  }
}

async function handleListOrders(_req, res, next) {
  try {
    const orders = await listOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
}

async function handleGetOrderById(req, res, next) {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCheckout,
  handleListOrders,
  handleGetOrderById,
};
