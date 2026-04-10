const crypto = require('crypto');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const RewardSettings = require('../models/RewardSettings');
const { effectiveUnitPrice } = require('../utils/productPrice');
const { createHostedPayment } = require('../services/paytabsService');

const CART_CURRENCY = (process.env.PAYTABS_CART_CURRENCY || 'QAR').trim();
const RETURN_URL = (process.env.PAYTABS_RETURN_URL || 'http://localhost:3000/payment-success').trim();
const CALLBACK_URL = (process.env.PAYTABS_CALLBACK_URL || 'http://localhost:5000/api/payment/callback').trim();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
}

async function assertCustomerEmailMatchesAccount(userId, email) {
  const em = String(email || '').trim().toLowerCase();
  const account = await User.findById(userId).select('email').lean();
  if (!account) {
    const err = new Error('Account not found');
    err.statusCode = 401;
    throw err;
  }
  if (em !== String(account.email).trim().toLowerCase()) {
    const err = new Error('Email must match your logged-in account');
    err.statusCode = 400;
    throw err;
  }
}

function verifyPaytabsSignature(rawBuffer, signatureHeader, serverKey) {
  if (process.env.PAYTABS_SKIP_SIGNATURE_VERIFY === 'true') return true;
  if (!signatureHeader || !serverKey || !rawBuffer || !rawBuffer.length) return false;
  const expected = crypto.createHmac('sha256', serverKey).update(rawBuffer).digest('hex');
  const received = String(signatureHeader).trim().toLowerCase();
  const exp = expected.toLowerCase();
  if (received.length !== exp.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(exp, 'utf8'), Buffer.from(received, 'utf8'));
  } catch {
    return false;
  }
}

async function buildOrderLinesFromCartItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, status: 400, message: 'items array is required' };
  }
  const lineInputs = [];
  for (const row of items) {
    const productId = row?.productId;
    const quantity = Math.floor(Number(row?.quantity));
    if (!isValidObjectId(productId)) {
      return { ok: false, status: 400, message: `Invalid productId: ${productId}` };
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
      return { ok: false, status: 400, message: 'Each item needs quantity between 1 and 999' };
    }
    lineInputs.push({ productId, quantity });
  }

  const productIds = lineInputs.map((l) => l.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const orderLines = [];
  let totalAmount = 0;

  for (const { productId, quantity } of lineInputs) {
    const p = byId.get(String(productId));
    if (!p) {
      return { ok: false, status: 400, message: `Product not found: ${productId}` };
    }
    const stock = Number(p.stock) || 0;
    if (stock < quantity) {
      return {
        ok: false,
        status: 400,
        message: `Insufficient stock for "${p.name}". Available: ${stock}, requested: ${quantity}.`
      };
    }
    const unitPrice = effectiveUnitPrice(p);
    const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
    totalAmount += lineTotal;
    orderLines.push({
      productId: p._id,
      name: p.name,
      quantity,
      unitPrice,
      lineTotal
    });
  }

  totalAmount = Math.round(totalAmount * 100) / 100;
  if (totalAmount <= 0) {
    return { ok: false, status: 400, message: 'Order total must be greater than zero' };
  }

  return { ok: true, orderLines, totalAmount };
}

function parseApproved(body) {
  const pr = body.payment_result || body.paymentResult || {};
  const status =
    pr.response_status ||
    pr.responseStatus ||
    body.response_status ||
    body.responseStatus ||
    body.resp_status ||
    body.respStatus;
  const approved = status === 'A' || status === 'Authorized' || status === 'approved';
  const tranRef =
    body.tran_ref ||
    body.tranRef ||
    pr.transaction_ref ||
    pr.transactionRef ||
    body.transaction_ref ||
    '';
  const cartId = body.cart_id || body.cartId || '';
  return { approved, tranRef, cartId, paymentResult: pr };
}

async function getGlobalRewardSettings() {
  const settings = await RewardSettings.findOne({ key: 'global' }).lean();
  if (!settings) {
    return { enabled: false, pointsPerCurrency: 0, pointsRequired: 100, discountValue: 10 };
  }
  return settings;
}

function calculateRewardBreakdown(orderTotal, usedPointsRaw, userPoints, settings) {
  const cleanOrderTotal = Math.round(Math.max(0, Number(orderTotal) || 0) * 100) / 100;
  const pointsPerCurrency = Math.max(0, Number(settings?.pointsPerCurrency) || 0);
  const pointsRequired = Math.max(1, Math.floor(Number(settings?.pointsRequired) || 100));
  const discountValue = Math.max(0, Number(settings?.discountValue) || 0);
  const rewardsEnabled = Boolean(settings?.enabled);

  const usedPoints = Math.max(0, Math.floor(Number(usedPointsRaw) || 0));
  if (!rewardsEnabled && usedPoints > 0) {
    const err = new Error('Rewards are currently disabled');
    err.statusCode = 400;
    throw err;
  }
  if (usedPoints > Math.max(0, Number(userPoints) || 0)) {
    const err = new Error('Used points cannot exceed available points');
    err.statusCode = 400;
    throw err;
  }
  if (usedPoints > 0 && usedPoints % pointsRequired !== 0) {
    const err = new Error(`Points must be in multiples of ${pointsRequired}`);
    err.statusCode = 400;
    throw err;
  }

  const requestedBlocks = Math.floor(usedPoints / pointsRequired);
  const requestedDiscount = requestedBlocks * discountValue;
  if (requestedDiscount > cleanOrderTotal) {
    const err = new Error('Requested points discount exceeds order total');
    err.statusCode = 400;
    throw err;
  }

  const discountApplied = Math.round(Math.max(0, requestedDiscount) * 100) / 100;
  const finalAmount = Math.round(Math.max(0, cleanOrderTotal - discountApplied) * 100) / 100;
  const earnedPoints = rewardsEnabled ? Math.floor(finalAmount * pointsPerCurrency) : 0;

  return {
    orderTotal: cleanOrderTotal,
    usedPoints,
    discountApplied,
    finalAmount,
    earnedPoints,
    pointsPerCurrency,
    pointsRequired,
    discountValue,
    rewardsEnabled
  };
}

/**
 * POST /api/payment/paytabs
 */
exports.createPayment = async (req, res, next) => {
  try {
    const { items, customer, usedPoints } = req.body || {};
    if (!customer || typeof customer !== 'object') {
      return res.status(400).json({ message: 'customer object is required' });
    }
    const fullName = typeof customer.fullName === 'string' ? customer.fullName.trim() : '';
    const email = typeof customer.email === 'string' ? customer.email.trim() : '';
    const phone = typeof customer.phone === 'string' ? customer.phone.trim() : '';
    const address = typeof customer.address === 'string' ? customer.address.trim() : '';
    if (!fullName || !email) {
      return res.status(400).json({ message: 'customer.fullName and customer.email are required' });
    }
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required for checkout' });
    }
    if (!address) {
      return res.status(400).json({ message: 'Delivery address is required for checkout' });
    }

    try {
      await assertCustomerEmailMatchesAccount(req.user.id, email);
    } catch (e) {
      return res.status(e.statusCode || 400).json({ message: e.message });
    }

    const built = await buildOrderLinesFromCartItems(items);
    if (!built.ok) {
      return res.status(built.status).json({ message: built.message });
    }
    let { orderLines, totalAmount } = built;
    const rewardSettings = await getGlobalRewardSettings();
    const account = await User.findById(req.user.id).select('points').lean();
    if (!account) {
      return res.status(401).json({ message: 'Account not found' });
    }
    const rewardCalc = calculateRewardBreakdown(totalAmount, usedPoints, account.points, rewardSettings);
    totalAmount = rewardCalc.finalAmount;

    if (totalAmount <= 0) {
      return res.status(400).json({ message: 'Order total must be greater than zero' });
    }

    const pending = await Order.create({
      userId: new mongoose.Types.ObjectId(req.user.id),
      cartId: new mongoose.Types.ObjectId().toString(),
      status: 'pending',
      paymentMethod: 'paytabs',
      currency: CART_CURRENCY,
      totalAmount,
      items: orderLines,
      customer: { fullName, email, phone, address },
      orderTotal: rewardCalc.orderTotal,
      earnedPoints: rewardCalc.earnedPoints,
      usedPoints: rewardCalc.usedPoints,
      discountApplied: rewardCalc.discountApplied,
      finalAmount: rewardCalc.finalAmount
    });

    const cartAmountStr = totalAmount.toFixed(2);
    const street1 = address.slice(0, 120) || 'N/A';
    const paytabsPayload = {
      tran_type: 'sale',
      tran_class: 'ecom',
      cart_id: pending.cartId,
      cart_description: 'Toronto Beauty Order',
      cart_currency: CART_CURRENCY,
      cart_amount: cartAmountStr,
      callback: CALLBACK_URL,
      return: RETURN_URL,
      customer_details: {
        name: fullName.slice(0, 120),
        email,
        phone: phone.slice(0, 32) || '00000000',
        street1,
        city: 'Doha',
        state: 'QA',
        country: 'QA',
        zip: '00000'
      }
    };

    try {
      const pt = await createHostedPayment(paytabsPayload);
      return res.status(200).json({
        redirect_url: pt.redirect_url,
        cart_id: pending.cartId,
        tran_ref: pt.tran_ref || null
      });
    } catch (err) {
      try {
        pending.status = 'failed';
        pending.failureReason = err.message || 'PayTabs request failed';
        await pending.save();
      } catch (saveErr) {
        // eslint-disable-next-line no-console
        console.error('[payment] could not save failed order:', saveErr);
      }
      return next(err);
    }
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/payment/cod — cash on delivery (QAR); stock reserved on place order.
 */
exports.createCodOrder = async (req, res, next) => {
  try {
    const { items, customer, usedPoints } = req.body || {};
    if (!customer || typeof customer !== 'object') {
      return res.status(400).json({ message: 'customer object is required' });
    }
    const fullName = typeof customer.fullName === 'string' ? customer.fullName.trim() : '';
    const email = typeof customer.email === 'string' ? customer.email.trim() : '';
    const phone = typeof customer.phone === 'string' ? customer.phone.trim() : '';
    const address = typeof customer.address === 'string' ? customer.address.trim() : '';
    if (!fullName || !email) {
      return res.status(400).json({ message: 'customer.fullName and customer.email are required' });
    }
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required for cash on delivery' });
    }
    if (!address) {
      return res.status(400).json({ message: 'Delivery address is required for cash on delivery' });
    }

    try {
      await assertCustomerEmailMatchesAccount(req.user.id, email);
    } catch (e) {
      return res.status(e.statusCode || 400).json({ message: e.message });
    }

    const built = await buildOrderLinesFromCartItems(items);
    if (!built.ok) {
      return res.status(built.status).json({ message: built.message });
    }
    let { orderLines, totalAmount } = built;
    const rewardSettings = await getGlobalRewardSettings();
    const account = await User.findById(req.user.id).select('points').lean();
    if (!account) {
      return res.status(401).json({ message: 'Account not found' });
    }
    const rewardCalc = calculateRewardBreakdown(totalAmount, usedPoints, account.points, rewardSettings);
    totalAmount = rewardCalc.finalAmount;

    if (totalAmount <= 0) {
      return res.status(400).json({ message: 'Order total must be greater than zero' });
    }

    const cartId = new mongoose.Types.ObjectId().toString();
    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      for (const line of orderLines) {
        const result = await Product.updateOne(
          { _id: line.productId, stock: { $gte: line.quantity } },
          { $inc: { stock: -line.quantity, soldCount: line.quantity } },
          { session }
        );
        if (result.modifiedCount !== 1) {
          throw new Error(`Stock no longer available for "${line.name}" — refresh and try again.`);
        }
      }
      const pointsResult = await User.updateOne(
        { _id: req.user.id, points: { $gte: rewardCalc.usedPoints } },
        { $inc: { points: rewardCalc.earnedPoints - rewardCalc.usedPoints } },
        { session }
      );
      if (pointsResult.matchedCount !== 1) {
        throw new Error('Insufficient reward points balance. Refresh and try again.');
      }
      const [created] = await Order.create(
        [
          {
            userId: new mongoose.Types.ObjectId(req.user.id),
            cartId,
            status: 'cod',
            paymentMethod: 'cod',
            currency: CART_CURRENCY,
            totalAmount,
            items: orderLines,
            customer: { fullName, email, phone, address },
            orderTotal: rewardCalc.orderTotal,
            earnedPoints: rewardCalc.earnedPoints,
            usedPoints: rewardCalc.usedPoints,
            discountApplied: rewardCalc.discountApplied,
            finalAmount: rewardCalc.finalAmount
          }
        ],
        { session }
      );
      await session.commitTransaction();
      return res.status(200).json({
        cart_id: created.cartId,
        order_id: String(created._id)
      });
    } catch (err) {
      if (session) {
        await session.abortTransaction().catch(() => {});
      }
      if (err && err.message && typeof err.message === 'string' && err.message.includes('Stock')) {
        return res.status(409).json({ message: err.message });
      }
      return next(err);
    } finally {
      if (session) {
        await session.endSession().catch(() => {});
      }
    }
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/payment/callback
 */
exports.paytabsCallback = async (req, res) => {
  const serverKey = process.env.PAYTABS_SERVER_KEY || '';
  const rawBuffer = req.rawBody && Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
  const sig =
    req.get('Signature') ||
    req.get('signature') ||
    req.get('PayTabs-Signature') ||
    req.get('paytabs-signature') ||
    '';

  if (!verifyPaytabsSignature(rawBuffer, sig, serverKey)) {
    // eslint-disable-next-line no-console
    console.warn('[PayTabs callback] Signature verification failed or missing');
    if (process.env.PAYTABS_SKIP_SIGNATURE_VERIFY !== 'true') {
      return res.status(401).json({ message: 'Invalid signature' });
    }
  }

  const body = req.body || {};
  const { approved, tranRef, cartId, paymentResult } = parseApproved(body);

  try {
    if (!cartId) {
      return res.status(400).json({ message: 'Missing cart_id' });
    }

    const order = await Order.findOne({ cartId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'cod' || order.paymentMethod === 'cod') {
      return res.status(200).json({ message: 'Ignored — not an online payment order' });
    }

    if (order.status === 'paid') {
      return res.status(200).json({ message: 'Already processed' });
    }

    if (!approved) {
      order.status = 'failed';
      order.failureReason =
        paymentResult?.response_message ||
        paymentResult?.responseMessage ||
        body.message ||
        'Payment not approved';
      order.paytabsResponse = body;
      if (tranRef) order.tranRef = tranRef;
      await order.save();
      return res.status(200).json({ message: 'Recorded as failed' });
    }

    if (!tranRef) {
      order.status = 'failed';
      order.failureReason = 'Approved but missing tran_ref';
      order.paytabsResponse = body;
      await order.save();
      return res.status(200).json({ message: 'Recorded as failed — no tran_ref' });
    }

    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      try {
        for (const line of order.items) {
          const result = await Product.updateOne(
            { _id: line.productId, stock: { $gte: line.quantity } },
            { $inc: { stock: -line.quantity, soldCount: line.quantity } },
            { session }
          );
          if (result.modifiedCount !== 1) {
            throw new Error(`Stock race for product ${line.productId}`);
          }
        }
        order.status = 'paid';
        order.tranRef = tranRef;
        order.paytabsResponse = body;
        order.failureReason = '';
        const pointsResult = await User.updateOne(
          { _id: order.userId, points: { $gte: Math.max(0, Number(order.usedPoints) || 0) } },
          { $inc: { points: (Math.max(0, Number(order.earnedPoints) || 0) - Math.max(0, Number(order.usedPoints) || 0)) } },
          { session }
        );
        if (pointsResult.matchedCount !== 1) {
          throw new Error('Insufficient reward points balance at payment confirmation');
        }
        await order.save({ session });
        await session.commitTransaction();
      } catch (e) {
        await session.abortTransaction().catch(() => {});
        await Order.findByIdAndUpdate(order._id, {
          status: 'failed',
          failureReason: e.message || 'Stock update failed after payment',
          tranRef,
          paytabsResponse: body
        });
        // eslint-disable-next-line no-console
        console.error('[PayTabs callback] Fulfillment error — manual reconciliation may be needed:', e);
      }
    } catch (sessionErr) {
      // eslint-disable-next-line no-console
      console.error('[PayTabs callback] Session error:', sessionErr);
      await Order.findByIdAndUpdate(order._id, {
        status: 'failed',
        failureReason: sessionErr.message || 'Transaction setup failed',
        tranRef,
        paytabsResponse: body
      }).catch(() => {});
    } finally {
      if (session) {
        await session.endSession().catch(() => {});
      }
    }

    return res.status(200).json({ message: 'OK' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PayTabs callback]', err);
    return res.status(500).json({ message: 'Callback error' });
  }
};

/**
 * POST /api/payment/lookup-order
 * Body: { reference } — Order _id or cartId (24-char hex). Optional { email } for extra verification.
 * Legacy: { email, orderId } or { email, cartId }.
 * Without email: returns order by ID only (simple track flow).
 */
exports.lookupOrderForCustomer = async (req, res, next) => {
  try {
    const { email, reference, orderId, cartId } = req.body || {};
    const emRaw = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const hasEmail = emRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emRaw);

    const ref =
      (typeof reference === 'string' && reference.trim()) ||
      (typeof orderId === 'string' && orderId.trim()) ||
      (typeof cartId === 'string' && cartId.trim()) ||
      '';

    if (!ref || !/^[a-f0-9]{24}$/i.test(ref)) {
      return res.status(400).json({
        message: 'Enter the 24-character Order ID from your confirmation (letters a–f and numbers).'
      });
    }

    let order = await Order.findById(ref).lean();
    if (!order) {
      order = await Order.findOne({ cartId: ref }).lean();
    }

    if (!order) {
      return res.status(404).json({ message: 'No order found for this Order ID.' });
    }

    if (hasEmail) {
      const orderEmail = String(order.customer?.email || '')
        .trim()
        .toLowerCase();
      if (orderEmail !== emRaw) {
        return res.status(404).json({ message: 'No order found. Check your email and Order ID.' });
      }
    }

    return res.status(200).json({
      order: {
        _id: order._id,
        cartId: order.cartId,
        status: order.status,
        paymentMethod: order.paymentMethod || 'paytabs',
        currency: order.currency,
        totalAmount: order.totalAmount,
        orderTotal: order.orderTotal || order.totalAmount,
        earnedPoints: order.earnedPoints || 0,
        usedPoints: order.usedPoints || 0,
        discountApplied: order.discountApplied || 0,
        finalAmount: order.finalAmount || order.totalAmount,
        items: order.items,
        customer: {
          fullName: order.customer?.fullName,
          email: order.customer?.email,
          phone: order.customer?.phone || '',
          address: order.customer?.address || ''
        },
        tranRef: order.tranRef || '',
        createdAt: order.createdAt
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/payment/order/:cartId
 */
exports.getOrderByCartId = async (req, res, next) => {
  try {
    const { cartId } = req.params;
    if (!cartId || !/^[a-f0-9]{24}$/i.test(cartId)) {
      return res.status(400).json({ message: 'Invalid cart id' });
    }
    const order = await Order.findOne({ cartId }).lean();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.status(200).json({
      order: {
        _id: order._id,
        cartId: order.cartId,
        status: order.status,
        paymentMethod: order.paymentMethod || 'paytabs',
        currency: order.currency,
        totalAmount: order.totalAmount,
        orderTotal: order.orderTotal || order.totalAmount,
        earnedPoints: order.earnedPoints || 0,
        usedPoints: order.usedPoints || 0,
        discountApplied: order.discountApplied || 0,
        finalAmount: order.finalAmount || order.totalAmount,
        items: order.items,
        tranRef: order.tranRef,
        createdAt: order.createdAt
      }
    });
  } catch (err) {
    return next(err);
  }
};

exports.getRewardsSummary = async (req, res, next) => {
  try {
    const [settings, account] = await Promise.all([
      getGlobalRewardSettings(),
      User.findById(req.user.id).select('points').lean()
    ]);
    if (!account) {
      return res.status(401).json({ message: 'Account not found' });
    }
    return res.status(200).json({
      rewards: {
        enabled: Boolean(settings.enabled),
        pointsPerCurrency: Math.max(0, Number(settings.pointsPerCurrency) || 0),
        pointsRequired: Math.max(1, Math.floor(Number(settings.pointsRequired) || 100)),
        discountValue: Math.max(0, Number(settings.discountValue) || 0),
        availablePoints: Math.max(0, Math.floor(Number(account.points) || 0))
      }
    });
  } catch (err) {
    return next(err);
  }
};

exports.previewRewards = async (req, res, next) => {
  try {
    const { items, usedPoints } = req.body || {};
    const built = await buildOrderLinesFromCartItems(items);
    if (!built.ok) {
      return res.status(built.status).json({ message: built.message });
    }
    const settings = await getGlobalRewardSettings();
    const account = await User.findById(req.user.id).select('points').lean();
    if (!account) {
      return res.status(401).json({ message: 'Account not found' });
    }
    const calc = calculateRewardBreakdown(
      built.totalAmount,
      usedPoints,
      account.points,
      settings
    );
    return res.status(200).json({
      preview: {
        orderTotal: calc.orderTotal,
        usedPoints: calc.usedPoints,
        discountApplied: calc.discountApplied,
        finalAmount: calc.finalAmount,
        earnedPoints: calc.earnedPoints,
        availablePoints: Math.max(0, Math.floor(Number(account.points) || 0))
      }
    });
  } catch (err) {
    return next(err);
  }
};
