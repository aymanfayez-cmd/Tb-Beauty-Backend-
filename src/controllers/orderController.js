const mongoose = require('mongoose');
const Order = require('../models/Order');

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
}

function serializeMyOrder(o) {
  return {
    _id: o._id,
    cartId: o.cartId,
    status: o.status,
    paymentMethod: o.paymentMethod || 'paytabs',
    currency: o.currency,
    totalAmount: o.totalAmount,
    orderTotal: o.orderTotal || o.totalAmount,
    earnedPoints: o.earnedPoints || 0,
    usedPoints: o.usedPoints || 0,
    discountApplied: o.discountApplied || 0,
    finalAmount: o.finalAmount || o.totalAmount,
    items: o.items,
    customer: o.customer,
    tranRef: o.tranRef || '',
    createdAt: o.createdAt
  };
}

function serializeOrder(o) {
  return {
    _id: o._id,
    cartId: o.cartId,
    userId: o.userId || null,
    status: o.status,
    paymentMethod: o.paymentMethod || 'paytabs',
    currency: o.currency,
    totalAmount: o.totalAmount,
    orderTotal: o.orderTotal || o.totalAmount,
    earnedPoints: o.earnedPoints || 0,
    usedPoints: o.usedPoints || 0,
    discountApplied: o.discountApplied || 0,
    finalAmount: o.finalAmount || o.totalAmount,
    items: o.items,
    customer: o.customer,
    tranRef: o.tranRef || '',
    failureReason: o.failureReason || '',
    createdAt: o.createdAt,
    updatedAt: o.updatedAt
  };
}

/**
 * GET /api/orders/mine — logged-in customer: their orders (newest first)
 */
exports.listMyOrders = async (req, res, next) => {
  try {
    const uid = req.user.id;
    if (!isValidObjectId(uid)) {
      return res.status(400).json({ message: 'Invalid account' });
    }
    const orders = await Order.find({ userId: uid })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      orders: orders.map(serializeMyOrder)
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/orders — admin: list orders (newest first)
 */
exports.listOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments()
    ]);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({
      orders: rows.map(serializeOrder),
      page,
      limit,
      total
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/orders/:id — admin: single order by Mongo _id
 */
exports.getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid order id' });
    }
    const order = await Order.findById(id).lean();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({ order: serializeOrder(order) });
  } catch (err) {
    return next(err);
  }
};
