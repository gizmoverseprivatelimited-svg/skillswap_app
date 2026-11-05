const express = require('express');
const router = express.Router();
const PointTransaction = require('../../models/PointTransaction');
const PayoutRequest = require('../../models/PayoutRequest');
const User = require('../../models/User');
const { emitToUser, broadcastEvent } = require('../../socket');

const POINTS_TO_CURRENCY_RATE = 0.02;

const PAYOUT_RATES = {
  store_credit: 1.0,
  upi: 0.80,
  bank_transfer: 0.80,
  paypal: 0.75,
};

// GET /earnings/summary/:userId
router.get('/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userTx = await PointTransaction.find({ userId });
    const userPo = await PayoutRequest.find({ userId });

    const totalEarnedPoints = userTx
      .filter(
        (t) =>
          t.type === 'earned' &&
          (t.source === 'class_taught' || t.source === 'learner_bonus' || t.source === 'monthly_subscription') &&
          t.source !== 'refund' &&
          !t.description?.toLowerCase().includes('refund')
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const redeemedPoints = userPo
      .filter((p) => p.status !== 'rejected')
      .reduce((sum, p) => sum + (p.credits || p.points || 0), 0);

    const availablePoints = Math.max(0, totalEarnedPoints - redeemedPoints);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentMonthTx = userTx.filter((t) => {
      const d = new Date(t.timestamp || t.createdAt);
      return (
        d.getMonth() === currentMonth &&
        d.getFullYear() === currentYear &&
        t.type === 'earned' &&
        (t.source === 'class_taught' || t.source === 'learner_bonus' || t.source === 'monthly_subscription') &&
        t.source !== 'refund' &&
        !t.description?.toLowerCase().includes('refund')
      );
    });

    const currentMonthPoints = currentMonthTx.reduce((sum, t) => sum + t.amount, 0);
    const currentMonthClasses = currentMonthTx.filter((t) => t.source === 'class_taught' && !t.description?.toLowerCase().includes('refund')).length;

    const totalPayouts = userPo.length;
    const completedPayouts = userPo.filter((p) => p.status === 'completed').length;
    const pendingPayouts = userPo.filter((p) => p.status === 'pending').length;

    res.json({
      userId,
      totalEarnedPoints,
      availablePoints,
      availableCurrency: Math.round(availablePoints * POINTS_TO_CURRENCY_RATE * 100) / 100,
      currentMonthPoints,
      currentMonthClasses,
      totalPayouts,
      completedPayouts,
      pendingPayouts,
    });
  } catch (err) {
    console.error('[Earnings Summary Error]', err);
    res.status(500).json({ message: 'Failed to fetch earnings summary' });
  }
});

// GET /earnings/transactions/:userId
router.get('/transactions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await PointTransaction.find({ userId }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    console.error('[Earnings Transactions Error]', err);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
});

// GET /earnings/payouts/:userId
router.get('/payouts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const payouts = await PayoutRequest.find({ userId }).sort({ createdAt: -1 });
    res.json(payouts);
  } catch (err) {
    console.error('[Earnings Payouts Error]', err);
    res.status(500).json({ message: 'Failed to fetch payouts' });
  }
});

// POST /earnings/award
router.post('/award', async (req, res) => {
  try {
    const { userId, amount, source, description, swapId } = req.body;
    if (!userId || !amount || !source) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const transaction = new PointTransaction({
      userId,
      amount: Number(amount),
      type: 'earned',
      source,
      description: description || 'Points awarded',
      swapId: swapId || null,
    });

    await transaction.save();

    res.status(201).json(transaction);
  } catch (err) {
    console.error('[Award Points Error]', err);
    res.status(500).json({ message: 'Failed to award points' });
  }
});

// POST /earnings/payout-request
router.post('/payout-request', async (req, res) => {
  try {
    const { userId, userName, userAvatar, points, method, payoutDetails } = req.body;
    if (!userId || !points || !method) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const numCredits = Number(req.body.credits || points || 0);
    const rate = PAYOUT_RATES[method] || 1.0;
    const isStoreCredit = method === 'store_credit';
    const amountCurrency = Math.round(numCredits * rate * 100) / 100;
    const status = isStoreCredit ? 'completed' : 'pending';

    const payout = new PayoutRequest({
      userId,
      userName: userName || 'User',
      userAvatar: userAvatar || '',
      points: numCredits,
      credits: numCredits,
      amount: amountCurrency,
      currency: 'INR',
      method,
      payoutDetails: payoutDetails || {},
      status,
      processedAt: isStoreCredit ? new Date() : null,
      transactionRef: isStoreCredit ? `SC-${Math.floor(10000 + Math.random() * 90000)}` : null,
    });

    await payout.save();

    const redeemTx = new PointTransaction({
      userId,
      amount: numCredits,
      type: 'redeemed',
      source: 'payout',
      description: `Redeemed for ${method.replace('_', ' ').toUpperCase()} (₹${amountCurrency})`,
    });

    await redeemTx.save();

    // If store_credit payout, increment user credits balance in User model
    if (isStoreCredit) {
      await User.findByIdAndUpdate(userId, { $inc: { credits: numCredits } });
    }

    emitToUser(userId, 'payout_updated', payout);
    emitToUser(userId, 'credits_updated', { userId });
    broadcastEvent('admin_payout_updated', payout);

    res.status(201).json(payout);
  } catch (err) {
    console.error('[Request Payout Error]', err);
    res.status(500).json({ message: 'Failed to create payout request' });
  }
});

// GET /earnings/admin/payouts
router.get('/admin/payouts', async (req, res) => {
  try {
    const payouts = await PayoutRequest.find({}).sort({ createdAt: -1 });
    res.json(payouts);
  } catch (err) {
    console.error('[Admin Payouts Fetch Error]', err);
    res.status(500).json({ message: 'Failed to fetch admin payouts' });
  }
});

// Helper function to format method name
const formatMethodName = (method) => {
  const map = {
    store_credit: 'Store Credit',
    bank_transfer: 'Bank Transfer',
    upi: 'UPI Transfer',
    paypal: 'PayPal',
  };
  return map[method] || method || 'Payout';
};

// PATCH /earnings/admin/payouts/:payoutId/approve
router.patch('/admin/payouts/:payoutId/approve', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { reviewedBy } = req.body;

    const payout = await PayoutRequest.findByIdAndUpdate(
      payoutId,
      {
        status: 'approved',
        reviewedBy: reviewedBy || 'admin',
        processedAt: new Date(),
      },
      { new: true }
    );

    if (!payout) return res.status(404).json({ message: 'Payout not found' });
    emitToUser(payout.userId, 'payout_updated', payout);
    emitToUser(payout.userId, 'credits_updated', { userId: payout.userId });
    broadcastEvent('admin_payout_updated', payout);

    // 🔔 Send real-time notification alert to the user
    const pointsAmount = payout.credits || payout.points || 0;
    const moneyAmount = payout.amount ? `₹${payout.amount}` : `${pointsAmount} Credits`;
    const methodName = formatMethodName(payout.method);

    emitToUser(payout.userId.toString(), 'new_notification', {
      category: 'system',
      title: '✅ Payout Request Approved!',
      body: `Your payout request of ${pointsAmount} credits (${moneyAmount}) via ${methodName} has been approved and is being processed.`,
      metadata: {
        payoutId: payout._id.toString(),
        type: 'payout-action',
        action: 'payout_approved',
        points: pointsAmount,
        amount: payout.amount,
        method: payout.method,
        status: 'approved',
        link: '/earnings/history',
      },
    });

    res.json(payout);
  } catch (err) {
    console.error('[Approve Payout Error]', err);
    res.status(500).json({ message: 'Failed to approve payout' });
  }
});

// PATCH /earnings/admin/payouts/:payoutId/reject
router.patch('/admin/payouts/:payoutId/reject', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { reviewedBy, rejectionReason } = req.body;

    const payout = await PayoutRequest.findByIdAndUpdate(
      payoutId,
      {
        status: 'rejected',
        reviewedBy: reviewedBy || 'admin',
        rejectionReason: rejectionReason || 'Rejected by admin',
        processedAt: new Date(),
      },
      { new: true }
    );

    if (!payout) return res.status(404).json({ message: 'Payout not found' });
    emitToUser(payout.userId, 'payout_updated', payout);
    emitToUser(payout.userId, 'credits_updated', { userId: payout.userId });
    broadcastEvent('admin_payout_updated', payout);

    // 🔔 Send real-time notification alert to the user
    const pointsAmount = payout.credits || payout.points || 0;
    const moneyAmount = payout.amount ? `₹${payout.amount}` : `${pointsAmount} Credits`;
    const methodName = formatMethodName(payout.method);
    const reasonText = rejectionReason || 'Rejected by admin';

    emitToUser(payout.userId.toString(), 'new_notification', {
      category: 'system',
      title: '❌ Payout Request Rejected',
      body: `Your payout request of ${pointsAmount} credits (${moneyAmount}) via ${methodName} was rejected. Reason: ${reasonText}. Your points remain in your balance.`,
      metadata: {
        payoutId: payout._id.toString(),
        type: 'payout-action',
        action: 'payout_rejected',
        points: pointsAmount,
        amount: payout.amount,
        method: payout.method,
        reason: reasonText,
        status: 'rejected',
        link: '/earnings/history',
      },
    });

    res.json(payout);
  } catch (err) {
    console.error('[Reject Payout Error]', err);
    res.status(500).json({ message: 'Failed to reject payout' });
  }
});

// PATCH /earnings/admin/payouts/:payoutId/complete
router.patch('/admin/payouts/:payoutId/complete', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { reviewedBy, transactionRef } = req.body;

    const txnRef = transactionRef || `TXN-${Date.now()}`;
    const payout = await PayoutRequest.findByIdAndUpdate(
      payoutId,
      {
        status: 'completed',
        reviewedBy: reviewedBy || 'admin',
        transactionRef: txnRef,
        processedAt: new Date(),
      },
      { new: true }
    );

    if (!payout) return res.status(404).json({ message: 'Payout not found' });
    emitToUser(payout.userId, 'payout_updated', payout);
    emitToUser(payout.userId, 'credits_updated', { userId: payout.userId });
    broadcastEvent('admin_payout_updated', payout);

    // 🔔 Send real-time notification alert to the user
    const pointsAmount = payout.credits || payout.points || 0;
    const moneyAmount = payout.amount ? `₹${payout.amount}` : `${pointsAmount} Credits`;
    const methodName = formatMethodName(payout.method);

    emitToUser(payout.userId.toString(), 'new_notification', {
      category: 'system',
      title: '🎉 Payout Completed!',
      body: `Your payout of ${pointsAmount} credits (${moneyAmount}) via ${methodName} has been completed! Reference: ${txnRef}`,
      metadata: {
        payoutId: payout._id.toString(),
        type: 'payout-action',
        action: 'payout_completed',
        points: pointsAmount,
        amount: payout.amount,
        method: payout.method,
        transactionRef: txnRef,
        status: 'completed',
        link: '/earnings/history',
      },
    });

    res.json(payout);
  } catch (err) {
    console.error('[Complete Payout Error]', err);
    res.status(500).json({ message: 'Failed to complete payout' });
  }
});

module.exports = router;
