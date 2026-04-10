const mongoose = require('mongoose');

const orderLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    cartId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cod'],
      default: 'pending',
      index: true
    },
    paymentMethod: {
      type: String,
      enum: ['paytabs', 'cod'],
      default: 'paytabs',
      index: true
    },
    currency: { type: String, default: 'QAR', trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    items: { type: [orderLineSchema], required: true },
    customer: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true },
      phone: { type: String, default: '', trim: true },
      address: { type: String, default: '', trim: true }
    },
    tranRef: { type: String, default: '', trim: true, index: true },
    paytabsResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    failureReason: { type: String, default: '', trim: true }
    ,
    orderTotal: { type: Number, default: 0, min: 0 },
    earnedPoints: { type: Number, default: 0, min: 0 },
    usedPoints: { type: Number, default: 0, min: 0 },
    discountApplied: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
