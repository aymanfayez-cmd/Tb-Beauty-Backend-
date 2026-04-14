const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const env = (process.env.NODE_ENV || '').toLowerCase();

  // In production, never fall back to a local DB because it can look like data "disappeared".
  if (!uri && env === 'production') {
    throw new Error('MONGODB_URI is required in production');
  }

  const finalUri = uri || 'mongodb://127.0.0.1:27017/tb-beauty';

  // Mongoose 8 uses the unified topology; keep options minimal.
  await mongoose.connect(finalUri);
  // eslint-disable-next-line no-console
  console.log(`MongoDB connected (${uri ? 'configured URI' : 'local fallback'})`);
};

