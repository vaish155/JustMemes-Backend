const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const availableSizes = ['xs', 's', 'm', 'l', 'xl'];

const products = [
  {
    name: 'The "Three Apples" Tee',
    description: 'Oversized fit with a bold campus-era vibe.',
    price: 1,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7Vw02bkwgzPdmBr_ir1F3mAuYoyzZdrvhlVOwYGLNazKAL3Npx-kW1dcH&s=10',
    stock: 25,
    size: ['xs', 's', 'm', 'l', 'xl']
  },
  {
    name: 'The "Blank Canvas" Tee',
    description: 'Classic fit for minimalists and late-night thinkers.',
    price: 1,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7Vw02bkwgzPdmBr_ir1F3mAuYoyzZdrvhlVOwYGLNazKAL3Npx-kW1dcH&s=10',
    stock: 18,
    size: ['s', 'm', 'l', 'xl']
  },
  {
    name: 'The "Low Battery" Tee',
    description: 'Premium heavyweight tee for the tired but stylish.',
    price: 1,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7Vw02bkwgzPdmBr_ir1F3mAuYoyzZdrvhlVOwYGLNazKAL3Npx-kW1dcH&s=10',
    stock: 12,
    size: ['m', 'l', 'xl']
  },
  {
    name: 'The "Campus Legend" Tee',
    description: 'A clean statement piece for the everyday legend.',
    price: 1,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7Vw02bkwgzPdmBr_ir1F3mAuYoyzZdrvhlVOwYGLNazKAL3Npx-kW1dcH&s=10',
    stock: 20,
    size: ['xs', 's', 'm']
  },
  {
    name: 'The "No Sleep" Hoodie',
    description: 'Soft hoodie made for long nights and early mornings.',
    price: 1,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7Vw02bkwgzPdmBr_ir1F3mAuYoyzZdrvhlVOwYGLNazKAL3Npx-kW1dcH&s=10',
    stock: 10,
    size: ['s', 'm', 'l', 'xl']
  },
  {
    name: 'The "Late Submit" Tee',
    description: 'A funny, wearable reminder of college life.',
    price: 1,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7Vw02bkwgzPdmBr_ir1F3mAuYoyzZdrvhlVOwYGLNazKAL3Npx-kW1dcH&s=10',
    stock: 30,
    size: ['xs', 's', 'm']
  },
  {
    name: 'The "Main Character" Tee',
    description: 'Bold enough to carry your whole personality.',
    price: 1,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7Vw02bkwgzPdmBr_ir1F3mAuYoyzZdrvhlVOwYGLNazKAL3Npx-kW1dcH&s=10',
    stock: 16,
    size: ['m', 'l', 'xl']
  },
  {
    name: 'The "Hot Girl Summer" Tee',
    description: 'Simple, stylish, and always ready for the next plan.',
    price: 1,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7Vw02bkwgzPdmBr_ir1F3mAuYoyzZdrvhlVOwYGLNazKAL3Npx-kW1dcH&s=10',
    stock: 14,
    size: ['xs', 's', 'm', 'l']
  },
  {
    name: 'The "Weekend Mode" Tee',
    description: 'Easygoing comfort with a strong campus aesthetic.',
    price: 1,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7Vw02bkwgzPdmBr_ir1F3mAuYoyzZdrvhlVOwYGLNazKAL3Npx-kW1dcH&s=10',
    stock: 22,
    size: ['xs', 's', 'm', 'l', 'xl']
  },
  {
    name: 'The "Vibe Check" Tee',
    description: 'A sharp everyday tee that keeps the energy up.',
    price: 1,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7Vw02bkwgzPdmBr_ir1F3mAuYoyzZdrvhlVOwYGLNazKAL3Npx-kW1dcH&s=10',
    stock: 17,
    size: ['s', 'm', 'l', 'xl']
  }
];

const productSchema = new mongoose.Schema({
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
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
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
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);

const orders = [
  {
    customerName: 'Aarav Sharma',
    contact: '9876543210',
    email: 'aarav@example.com',
    address: 'Hostel Block A',
    roomNumber: '101',
    hostelName: 'Sunrise Hostel',
    items: [
      {
        productId: 'placeholder-product-id',
        productName: 'The "Three Apples" Tee',
        size: 'm',
        quantity: 1,
        price: 1
      }
    ],
    subtotal: 1,
    total: 1,
    paymentStatus: 'paid',
    orderStatus: 'delivered'
  },
  {
    customerName: 'Mira Patel',
    contact: '9123456780',
    email: 'mira@example.com',
    address: 'Hostel Block B',
    roomNumber: '205',
    hostelName: 'Moonlight Hostel',
    items: [
      {
        productId: 'placeholder-product-id',
        productName: 'The "Blank Canvas" Tee',
        size: 'l',
        quantity: 2,
        price: 1
      }
    ],
    subtotal: 2,
    total: 2,
    paymentStatus: 'pending',
    orderStatus: 'placed'
  }
];

async function seedProducts() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Please add it to your .env file.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await Product.deleteMany({});
    await Order.deleteMany({});

    const insertedProducts = await Product.insertMany(products);
    const seededOrders = orders.map((order, index) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        productId: insertedProducts[index % insertedProducts.length]._id.toString()
      }))
    }));

    const insertedOrders = await Order.insertMany(seededOrders);

    console.log(`Seeded ${insertedProducts.length} products and ${insertedOrders.length} orders successfully.`);
  } catch (error) {
    console.error('Seeding failed:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

seedProducts();
