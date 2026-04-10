const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const isProduction = process.env.NODE_ENV === 'production';
  const uri = process.env.MONGODB_URI || (!isProduction ? 'mongodb://127.0.0.1:27017/tb-beauty' : '');

  if (!uri) {
    throw new Error('MONGODB_URI is required in production environment');
  }

  // Mongoose 8 uses the unified topology; keep options minimal.
  await mongoose.connect(uri);
  // eslint-disable-next-line no-console
  console.log('MongoDB connected');
};

