const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function updatePrices() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Please add it to your .env file.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await mongoose.connection.db
      .collection('products')
      .updateMany({}, { $set: { price: 1 } });

    console.log(`Updated ${result.modifiedCount} products to ₹1.`);
  } catch (error) {
    console.error('Update failed:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

updatePrices();
