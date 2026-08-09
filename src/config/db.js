const mongoose = require('mongoose');

let isConnected = false;

async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set. Product routes require a database connection.');
    isConnected = false;
    return false;
  }

  try {
    await mongoose.connect(mongoUri, { dbName: 'justmemes' });
    isConnected = true;
    console.log('MongoDB connected');
    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    isConnected = false;
    return false;
  }
}

function getIsConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = {
  connectToDatabase,
  getIsConnected,
};
