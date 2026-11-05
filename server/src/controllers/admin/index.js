const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const User = require('../../models/User');
const Review = require('../../models/Review');
const Verification = require('../../models/VerificationRequest');
const PointTransaction = require('../../models/PointTransaction');
const PaymentOrder = require('../../models/PaymentOrder');
const { emitToUser, broadcastEvent } = require('../../socket');

/*
  PATCH /api/admin/users/:userId/ban
*/
router.patch('/:userId/ban', async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        if (!reason) {
            return res.status(400).json({ message: 'Ban reason is required' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                banStatus: 'banned',
                banReason: reason,
                bannedAt: new Date(),
                suspendedUntil: null,
                daysSuspended: null,
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Real-time broadcast to all clients and target user
        broadcastEvent('user_updated', updatedUser);
        emitToUser(userId, 'user_banned', { userId, banStatus: 'banned', reason, user: updatedUser });
        emitToUser(userId, 'user_updated', updatedUser);

        res.json({
            message: 'User permanently banned successfully',
            user: updatedUser,
        });
    } catch (error) {
        console.error('[Ban User Error]', error);
        res.status(500).json({ message: 'Server error banning user' });
    }
});


/*
  PATCH /api/admin/users/:userId/unban
*/
router.patch('/:userId/unban', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                banStatus: 'active',
                banReason: null,
                bannedAt: null,
                suspendedUntil: null,
                daysSuspended: null,
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Real-time broadcast to all clients and target user
        broadcastEvent('user_updated', updatedUser);
        emitToUser(userId, 'user_unbanned', { userId, banStatus: 'active', user: updatedUser });
        emitToUser(userId, 'user_updated', updatedUser);

        res.json({
            message: 'User unbanned successfully',
            user: updatedUser,
        });
    } catch (error) {
        console.error('[Unban User Error]', error);
        res.status(500).json({ message: 'Server error unbanning user' });
    }
});


/*
  PATCH /api/admin/users/:userId/suspend
*/
router.patch('/:userId/suspend', async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason, days = 7 } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        if (!reason) {
            return res.status(400).json({ message: 'Suspension reason required' });
        }

        const numDays = Math.max(1, parseInt(days, 10) || 7);
        const suspendedUntil = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                banStatus: 'suspended',
                banReason: reason,
                bannedAt: new Date(),
                suspendedUntil,
                daysSuspended: numDays,
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Real-time broadcast to all clients and target user
        broadcastEvent('user_updated', updatedUser);
        emitToUser(userId, 'user_suspended', {
            userId,
            banStatus: 'suspended',
            reason,
            suspendedUntil,
            daysSuspended: numDays,
            user: updatedUser,
        });
        emitToUser(userId, 'user_updated', updatedUser);

        res.json({
            message: `User suspended for ${numDays} day(s) successfully`,
            user: updatedUser,
        });
    } catch (error) {
        console.error('[Suspend User Error]', error);
        res.status(500).json({ message: 'Server error suspending user' });
    }
});

/*
  PATCH /api/admin/users/:userId/credits
*/
router.patch('/:userId/credits', async (req, res) => {
    try {
        const { userId } = req.params;
        const { credits } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        if (typeof credits !== 'number') {
            return res.status(400).json({ message: 'Credits must be a number' });
        }

        const existingUser = await User.findById(userId);
        const oldCredits = existingUser?.credits || 0;
        const delta = credits - oldCredits;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { credits },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Record point transaction
        if (delta !== 0) {
            try {
                const txn = await PointTransaction.create({
                    userId,
                    amount: Math.abs(delta),
                    type: delta > 0 ? 'earned' : 'redeemed',
                    source: 'admin_adjustment',
                    description: `Admin balance adjustment (${delta > 0 ? '+' : ''}${delta} credits)`,
                });
                broadcastEvent('transaction_created', txn);
            } catch (txErr) {
                console.warn('[Admin Update Credits Txn Error]', txErr);
            }
        }

        // Real-time broadcast
        broadcastEvent('user_updated', updatedUser);
        emitToUser(userId, 'credits_updated', { userId, credits, newBalance: credits, delta });
        emitToUser(userId, 'user_updated', updatedUser);

        res.json({
            message: 'Credits updated successfully',
            user: updatedUser,
        });
    } catch (error) {
        console.error('[Update Credits Error]', error);
        res.status(500).json({ message: 'Server error updating credits' });
    }
});



// GET all reviews (Admin)
router.get('/reviews', async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate('reviewerId', 'name avatarUrl')
            .populate('revieweeId', 'name avatarUrl')
            .sort({ createdAt: -1 });

        const formatted = reviews.map(r => ({
            id: r._id,
            reviewerId: r.reviewerId?._id,
            reviewerName: r.reviewerId?.name,
            reviewerAvatar: r.reviewerId?.avatarUrl,

            revieweeId: r.revieweeId?._id,
            revieweeName: r.revieweeId?.name,
            revieweeAvatar: r.revieweeId?.avatarUrl,

            rating: r.rating,
            comment: r.comment,
            createdAt: r.createdAt,

            flaggedAt: r.flaggedAt,
            flagReason: r.flagReason,
            flagReporterId: r.flagReporterId,

            moderationStatus: r.moderationStatus, // you can later store this in DB
        }));

        res.json({ reviews: formatted });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch reviews' });
    }
});

// ✅ Approve Review
router.patch('/reviews/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        const review = await Review.findByIdAndUpdate(
            id,
            {
                moderationStatus: 'approved',
                moderatedAt: new Date(),
                moderationNote: note || null,
            },
            { new: true }
        );

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Real-time broadcast
        broadcastEvent('review_updated', review);
        broadcastEvent('review_moderated', review);
        if (review.revieweeId) {
            emitToUser(review.revieweeId, 'review_updated', review);
        }

        res.json({ review });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to approve review' });
    }
});


// ✅ Reject Review
router.patch('/reviews/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        const review = await Review.findByIdAndUpdate(
            id,
            {
                moderationStatus: 'rejected',
                moderatedAt: new Date(),
                moderationNote: note,
            },
            { new: true }
        );

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Real-time broadcast
        broadcastEvent('review_updated', review);
        broadcastEvent('review_moderated', review);
        if (review.revieweeId) {
            emitToUser(review.revieweeId, 'review_updated', review);
        }

        res.json({ review });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to reject review' });
    }
});

// verifications

router.get('/verifications', async (req, res) => {
    try {
        const verifications = await Verification.find()
            .populate('userId', 'name avatarUrl email')
            .sort({ createdAt: -1 });

        res.json({ verifications });

    } catch (error) {
        console.error('Fetch verifications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// ✅ Approve Verification
router.patch('/verifications/:id/approve', async (req, res) => {
    try {
        const verification = await Verification.findByIdAndUpdate(
            req.params.id,
            { status: 'verified' },
            { new: true }
        ).populate('userId', 'name avatarUrl email');

        if (!verification) {
            return res.status(404).json({ message: 'Not found' });
        }

        const targetUserId = verification.userId?._id ? verification.userId._id.toString() : (verification.userId ? String(verification.userId) : null);
        if (targetUserId) {
            const updatePayload = { isVerified: true };
            if (verification.type === 'identity') updatePayload.isIdentityVerified = true;
            if (verification.type === 'email') updatePayload.isEmailVerified = true;
            if (verification.type === 'phone') updatePayload.isPhoneVerified = true;
            if (verification.type === 'linkedin') updatePayload.isLinkedInVerified = true;
            const updatedUser = await User.findByIdAndUpdate(targetUserId, updatePayload, { new: true });
            if (updatedUser) {
                broadcastEvent('user_updated', updatedUser);
                emitToUser(targetUserId, 'user_updated', updatedUser);
                emitToUser(targetUserId, 'user_verified', { userId: targetUserId, isVerified: true, verification });
            }
            emitToUser(targetUserId, 'verification_approved', verification);
        }
        broadcastEvent('verification_updated', verification);

        res.json({ verification });

    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


// ✅ Reject Verification
router.patch('/verifications/:id/reject', async (req, res) => {
    try {
        const verification = await Verification.findByIdAndUpdate(
            req.params.id,
            { status: 'rejected' },
            { new: true }
        ).populate('userId', 'name avatarUrl email');

        if (!verification) {
            return res.status(404).json({ message: 'Not found' });
        }

        const targetUserId = verification.userId?._id ? verification.userId._id.toString() : (verification.userId ? String(verification.userId) : null);
        if (targetUserId) {
            emitToUser(targetUserId, 'verification_rejected', verification);
        }
        broadcastEvent('verification_updated', verification);

        res.json({ verification });

    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/admin/transactions or /api/admin/users/transactions
 * Retrieve all user point and monetary transactions with user details, type, source, amount/quantity
 */
const getAdminTransactions = async (req, res) => {
    try {
        const { type, source, userId, search, limit = 200 } = req.query;

        const query = {};
        if (type && type !== 'all') {
            query.type = type;
        }
        if (source && source !== 'all') {
            query.source = source;
        }
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            query.userId = userId;
        }

        const pointTxns = await PointTransaction.find(query)
            .populate('userId', 'name email username avatarUrl credits premiumTier phone')
            .sort({ createdAt: -1, timestamp: -1 })
            .limit(parseInt(limit, 10) || 200)
            .lean();

        // Also fetch real money payment orders
        const paymentOrders = await PaymentOrder.find(userId && mongoose.Types.ObjectId.isValid(userId) ? { userId } : {})
            .populate('userId', 'name email username avatarUrl credits premiumTier phone')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        const formattedPointTxns = pointTxns.map((tx) => {
            const rawAmount = typeof tx.amount === 'number' ? tx.amount : 0;
            const resolvedType = tx.type === 'earned' ? 'earned' : 'redeemed';
            return {
                id: tx._id ? tx._id.toString() : String(Date.now()),
                _id: tx._id ? tx._id.toString() : String(Date.now()),
                userId: tx.userId?._id ? tx.userId._id.toString() : (tx.userId ? String(tx.userId) : ''),
                userName: tx.userId?.name || 'Community Member',
                userEmail: tx.userId?.email || '',
                userUsername: tx.userId?.username || '',
                userAvatar: tx.userId?.avatarUrl || '',
                userCredits: tx.userId?.credits ?? 0,
                userTier: tx.userId?.premiumTier || 'free',
                amount: rawAmount,
                quantity: Math.abs(rawAmount),
                type: resolvedType, // 'earned' | 'redeemed'
                source: tx.source || 'swap_completed',
                description: tx.description || `${resolvedType === 'earned' ? 'Earned' : 'Redeemed'} ${Math.abs(rawAmount)} credits`,
                swapId: tx.swapId || null,
                currency: 'credits',
                isMoneyPayment: false,
                timestamp: tx.timestamp || tx.createdAt || new Date().toISOString(),
                createdAt: tx.createdAt ? tx.createdAt.toISOString() : (tx.timestamp ? new Date(tx.timestamp).toISOString() : new Date().toISOString()),
            };
        });

        const formattedPaymentOrders = paymentOrders.map((order) => ({
            id: order._id ? order._id.toString() : String(order.orderId),
            _id: order._id ? order._id.toString() : String(order.orderId),
            userId: order.userId?._id ? order.userId._id.toString() : (order.userId ? String(order.userId) : ''),
            userName: order.userId?.name || 'Community Member',
            userEmail: order.userId?.email || '',
            userUsername: order.userId?.username || '',
            userAvatar: order.userId?.avatarUrl || '',
            userCredits: order.userId?.credits ?? 0,
            userTier: order.userId?.premiumTier || 'free',
            amount: order.amount || 0,
            quantity: order.amount || 0,
            type: order.status === 'PAID' ? 'earned' : 'pending',
            source: order.purchaseType === 'premium' ? 'monthly_subscription' : 'top_up',
            description: order.purchaseType === 'premium'
                ? `Premium Membership Purchase (${order.tier || 'Pro'} Tier - ₹${order.amount})`
                : `Credit Pack Purchase (${order.packageId || 'Credits'} - ₹${order.amount})`,
            paymentOrderId: order.orderId,
            paymentStatus: order.status,
            currency: order.currency || 'INR',
            isMoneyPayment: true,
            timestamp: order.createdAt || new Date().toISOString(),
            createdAt: order.createdAt ? order.createdAt.toISOString() : new Date().toISOString(),
        }));

        let allTransactions = [...formattedPointTxns, ...formattedPaymentOrders].sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Filter by search term if provided
        if (search && search.trim().length > 0) {
            const s = search.trim().toLowerCase();
            allTransactions = allTransactions.filter((tx) =>
                tx.userName?.toLowerCase().includes(s) ||
                tx.userEmail?.toLowerCase().includes(s) ||
                tx.userUsername?.toLowerCase().includes(s) ||
                tx.description?.toLowerCase().includes(s) ||
                tx.source?.toLowerCase().includes(s) ||
                tx.id?.toLowerCase().includes(s)
            );
        }

        const totalCreditsEarned = formattedPointTxns.filter((t) => t.type === 'earned').reduce((acc, cur) => acc + (cur.amount || 0), 0);
        const totalCreditsRedeemed = formattedPointTxns.filter((t) => t.type === 'redeemed').reduce((acc, cur) => acc + Math.abs(cur.amount || 0), 0);
        const totalMoneyVolume = formattedPaymentOrders.filter((o) => o.paymentStatus === 'PAID').reduce((acc, cur) => acc + (cur.amount || 0), 0);

        res.json({
            success: true,
            transactions: allTransactions,
            stats: {
                totalTransactions: allTransactions.length,
                totalCreditsEarned,
                totalCreditsRedeemed,
                totalMoneyVolume,
                pointTransactionsCount: formattedPointTxns.length,
                paymentOrdersCount: formattedPaymentOrders.length,
            },
        });
    } catch (error) {
        console.error('[Admin Transactions Error]', error);
        res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
    }
};

router.get('/transactions', getAdminTransactions);
router.get('/users/transactions', getAdminTransactions);

module.exports = router;