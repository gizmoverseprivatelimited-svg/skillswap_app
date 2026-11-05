const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../../models/User');
const PaymentOrder = require('../../models/PaymentOrder');
const PointTransaction = require('../../models/PointTransaction');

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || '';
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || '';
const CASHFREE_ENV = (process.env.CASHFREE_ENV || 'production').toLowerCase();
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || '2023-08-01';

const CASHFREE_BASE_URL = CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.warn('[Cashfree] WARNING: CASHFREE_APP_ID or CASHFREE_SECRET_KEY is not configured.');
} else {
    console.log(`[Cashfree] Initialized in ${CASHFREE_ENV} mode with App ID: ${CASHFREE_APP_ID.substring(0, 8)}...`);
}

const creditPackages = {
    starter: { name: 'Starter', credits: 99, bonusCredits: 0, price: 99 },
    basic: { name: 'Basic', credits: 249, bonusCredits: 15, price: 249 },
    popular: { name: 'Popular', credits: 499, bonusCredits: 40, price: 499 },
    pro: { name: 'Pro', credits: 999, bonusCredits: 100, price: 999 },
    premium: { name: 'Premium', credits: 1999, bonusCredits: 250, price: 1999 },
    ultimate: { name: 'Ultimate', credits: 4999, bonusCredits: 750, price: 4999 },
};

const premiumTiers = {
    monthly: { name: 'Monthly', planId: 'leteski_monthly_199', price: 199, monthlyCredits: 50, bonusCredits: 50, durationDays: 30, intervalType: 'MONTH', intervals: 1, maxCycles: 36 },
    quarterly: { name: 'Quarterly', planId: 'leteski_quarterly_499', price: 499, monthlyCredits: 200, bonusCredits: 200, durationDays: 90, intervalType: 'MONTH', intervals: 3, maxCycles: 12 },
    yearly: { name: 'Yearly', planId: 'leteski_yearly_1499', price: 1499, monthlyCredits: 750, bonusCredits: 750, durationDays: 365, intervalType: 'MONTH', intervals: 12, maxCycles: 5 },
    // Backward compatibility aliases
    basic: { name: 'Monthly', planId: 'leteski_monthly_199', price: 199, monthlyCredits: 50, bonusCredits: 50, durationDays: 30, intervalType: 'MONTH', intervals: 1, maxCycles: 36 },
    premium: { name: 'Quarterly', planId: 'leteski_quarterly_499', price: 499, monthlyCredits: 200, bonusCredits: 200, durationDays: 90, intervalType: 'MONTH', intervals: 3, maxCycles: 12 },
    elite: { name: 'Yearly', planId: 'leteski_yearly_1499', price: 1499, monthlyCredits: 750, bonusCredits: 750, durationDays: 365, intervalType: 'MONTH', intervals: 12, maxCycles: 5 },
};

/**
 * Helper: Cashfree API request headers
 */
function getCashfreeHeaders() {
    return {
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': CASHFREE_API_VERSION,
        'Content-Type': 'application/json',
    };
}

/**
 * Helper: Ensure recurring subscription plan exists on Cashfree
 */
async function ensureCashfreePlan(tierKey, tierInfo) {
    const planId = tierInfo.planId || `leteski_${tierKey}_${tierInfo.price}`;
    try {
        const getRes = await axios.get(
            `${CASHFREE_BASE_URL}/plans/${planId}`,
            { headers: getCashfreeHeaders() }
        );
        if (getRes.data && getRes.data.plan_id) {
            return getRes.data;
        }
    } catch (err) {
        if (err.response?.status === 404 || err.response?.data?.type === 'invalid_request_error' || err.response?.data?.code === 'plan_not_found') {
            try {
                const createRes = await axios.post(
                    `${CASHFREE_BASE_URL}/plans`,
                    {
                        plan_id: planId,
                        plan_name: `Leteski Premium ${tierInfo.name}`,
                        plan_type: 'PERIODIC',
                        plan_currency: 'INR',
                        plan_recurring_amount: Number(tierInfo.price.toFixed(2)),
                        plan_max_amount: Number(tierInfo.price.toFixed(2)),
                        plan_max_cycles: tierInfo.maxCycles || 24,
                        plan_intervals: tierInfo.intervals || 1,
                        plan_interval_type: tierInfo.intervalType || 'MONTH',
                        plan_note: `Leteski ${tierInfo.name} Autopay Plan`,
                    },
                    { headers: getCashfreeHeaders() }
                );
                console.log(`[Cashfree Autopay] Created plan ${planId}`);
                return createRes.data;
            } catch (createErr) {
                console.warn(`[Cashfree Autopay] Create plan error (${planId}):`, createErr.response?.data || createErr.message);
                throw createErr;
            }
        }
        console.warn(`[Cashfree Autopay] Get plan error (${planId}):`, err.response?.data || err.message);
        throw err;
    }
}

/**
 * Helper: Idempotent order fulfillment for one-time payments
 */
async function fulfillPaymentOrder(orderId, cashfreeOrderData = {}) {
    try {
        const order = await PaymentOrder.findOne({ orderId });
        if (!order) {
            console.error(`[Fulfill Order] Order not found: ${orderId}`);
            return { success: false, message: 'Order record not found' };
        }

        // If already credited, skip crediting again
        if (order.status === 'PAID' && order.creditedAt) {
            const user = await User.findById(order.userId);
            return { success: true, alreadyCredited: true, user };
        }

        const user = await User.findById(order.userId);
        if (!user) {
            console.error(`[Fulfill Order] User not found for order: ${orderId}`);
            return { success: false, message: 'User not found' };
        }

        if (order.purchaseType === 'credits') {
            const pkg = creditPackages[order.packageId];
            const creditsToAdd = pkg ? (pkg.credits + (pkg.bonusCredits || 0)) : 0;

            if (creditsToAdd > 0) {
                user.credits = (user.credits || 0) + creditsToAdd;
                await user.save();

                await PointTransaction.create({
                    userId: user._id,
                    amount: creditsToAdd,
                    type: 'earned',
                    source: 'top_up',
                    description: `Top-up: Purchased ${pkg?.credits} credits${pkg?.bonusCredits > 0 ? ` + ${pkg.bonusCredits} bonus` : ''} via Cashfree`,
                });
            }
        } else if (order.purchaseType === 'premium') {
            const tierInfo = premiumTiers[order.tier] || premiumTiers.monthly;
            if (tierInfo) {
                const now = Date.now();
                const days = tierInfo.durationDays || (order.duration === 'yearly' ? 365 : (order.duration === 'quarterly' ? 90 : 30));
                const durationMs = days * 24 * 60 * 60 * 1000;
                const bonusCreditsToAdd = tierInfo.bonusCredits || tierInfo.monthlyCredits || 50;

                const normalizedTier = (order.tier === 'yearly' || order.tier === 'elite')
                    ? 'elite'
                    : (order.tier === 'quarterly' || order.tier === 'premium')
                        ? 'premium'
                        : 'basic';

                user.premiumTier = normalizedTier;
                const currentExpiry = (user.premiumExpiresAt && new Date(user.premiumExpiresAt).getTime() > now)
                    ? new Date(user.premiumExpiresAt).getTime()
                    : now;
                user.premiumExpiresAt = new Date(currentExpiry + durationMs);
                user.credits = (user.credits || 0) + bonusCreditsToAdd;
                await user.save();

                await PointTransaction.create({
                    userId: user._id,
                    amount: bonusCreditsToAdd,
                    type: 'earned',
                    source: 'monthly_subscription',
                    description: `Subscribed to ${tierInfo.name} Plan via Cashfree (${bonusCreditsToAdd} bonus credits)`,
                });
            }
        }

        order.status = 'PAID';
        order.creditedAt = new Date();
        order.paymentDetails = cashfreeOrderData;
        await order.save();

        // Broadcast real-time socket events
        try {
            const { emitToUser, broadcastEvent } = require('../../socket');
            emitToUser(user._id.toString(), 'credits_updated', { userId: user._id, credits: user.credits, newBalance: user.credits });
            emitToUser(user._id.toString(), 'payment_success', { userId: user._id, credits: user.credits, purchaseType: order.purchaseType });
            emitToUser(user._id.toString(), 'user_updated', user);
            broadcastEvent('user_updated', { userId: user._id, premiumTier: user.premiumTier, credits: user.credits });
        } catch (socketErr) {
            console.warn('[Socket Payment Broadcast Warning]', socketErr.message);
        }

        console.log(`[Fulfill Order] Successfully fulfilled order ${orderId} for user ${user._id}`);
        return { success: true, user };
    } catch (err) {
        console.error(`[Fulfill Order Error] ${orderId}:`, err);
        return { success: false, message: err.message };
    }
}

/**
 * Helper: Idempotent fulfillment for Cashfree recurring subscriptions / autopay
 */
async function fulfillSubscription(subscriptionId, cashfreeSubData = {}) {
    try {
        const order = await PaymentOrder.findOne({
            $or: [{ subscriptionId }, { orderId: subscriptionId }]
        });
        if (!order) {
            console.error(`[Fulfill Subscription] Subscription record not found: ${subscriptionId}`);
            return { success: false, message: 'Subscription record not found' };
        }

        if (order.status === 'PAID' && order.creditedAt) {
            const user = await User.findById(order.userId);
            return { success: true, alreadyCredited: true, user };
        }

        const user = await User.findById(order.userId);
        if (!user) {
            console.error(`[Fulfill Subscription] User not found for subscription: ${subscriptionId}`);
            return { success: false, message: 'User not found' };
        }

        const tierInfo = premiumTiers[order.tier] || premiumTiers.monthly;
        const now = Date.now();
        const days = tierInfo.durationDays || (order.duration === 'yearly' ? 365 : (order.duration === 'quarterly' ? 90 : 30));
        const durationMs = days * 24 * 60 * 60 * 1000;
        const bonusCreditsToAdd = tierInfo.bonusCredits || tierInfo.monthlyCredits || 50;

        const normalizedTier = (order.tier === 'yearly' || order.tier === 'elite')
            ? 'elite'
            : (order.tier === 'quarterly' || order.tier === 'premium')
                ? 'premium'
                : 'basic';

        user.premiumTier = normalizedTier;
        const currentExpiry = (user.premiumExpiresAt && new Date(user.premiumExpiresAt).getTime() > now)
            ? new Date(user.premiumExpiresAt).getTime()
            : now;
        user.premiumExpiresAt = new Date(currentExpiry + durationMs);
        user.credits = (user.credits || 0) + bonusCreditsToAdd;
        await user.save();

        await PointTransaction.create({
            userId: user._id,
            amount: bonusCreditsToAdd,
            type: 'earned',
            source: 'monthly_subscription',
            description: `Autopay Subscription: ${tierInfo.name} Plan via Cashfree (${bonusCreditsToAdd} bonus credits)`,
        });

        order.status = 'PAID';
        order.creditedAt = new Date();
        order.paymentDetails = cashfreeSubData;
        await order.save();

        // Broadcast real-time socket events
        try {
            const { emitToUser, broadcastEvent } = require('../../socket');
            emitToUser(user._id.toString(), 'credits_updated', { userId: user._id, credits: user.credits, newBalance: user.credits });
            emitToUser(user._id.toString(), 'payment_success', { userId: user._id, credits: user.credits, purchaseType: 'premium' });
            emitToUser(user._id.toString(), 'user_updated', user);
            broadcastEvent('user_updated', { userId: user._id, premiumTier: user.premiumTier, credits: user.credits });
        } catch (socketErr) {
            console.warn('[Socket Payment Broadcast Warning]', socketErr.message);
        }

        console.log(`[Fulfill Subscription] Successfully activated Autopay subscription ${subscriptionId} for user ${user._id}`);
        return { success: true, user };
    } catch (err) {
        console.error(`[Fulfill Subscription Error] ${subscriptionId}:`, err);
        return { success: false, message: err.message };
    }
}

/**
 * POST /payments/create-order
 * Initiates order with Cashfree PG (One-time credits or Recurring Autopay subscription)
 */
router.post('/create-order', async (req, res) => {
    try {
        const { userId, purchaseType, packageId, tier, duration, origin } = req.body;

        if (!userId || !purchaseType) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Clean user phone (must be 10 digits for Indian standard or valid number)
        let phone = '9999999999';
        if (user.phone) {
            const digits = String(user.phone).replace(/\D/g, '');
            if (digits.length >= 10) {
                phone = digits.slice(-10);
            }
        }

        const returnOrigin = origin || '';
        const publicBaseUrl = process.env.BACKEND_PUBLIC_URL || '';
        let returnUrlBase = '';
        if (publicBaseUrl) {
            returnUrlBase = publicBaseUrl.replace(/\/$/, '');
        } else {
            const host = req.get('host') || 'localhost:3201';
            const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
            const protocol = (isLocal && CASHFREE_ENV !== 'production') ? (req.protocol || 'http') : 'https';
            returnUrlBase = `${protocol}://${host}`;
        }

        // =========================================================================
        // 1. RECURRING AUTOPAY SUBSCRIPTION (purchaseType === 'premium')
        // =========================================================================
        if (purchaseType === 'premium') {
            const tierInfo = premiumTiers[tier];
            if (!tierInfo) {
                return res.status(400).json({ message: 'Invalid premium tier' });
            }
            const price = tierInfo.price || (duration === 'yearly' ? 1499 : (duration === 'quarterly' ? 499 : 199));
            const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const subReturnUrl = `${returnUrlBase}/payments/subscription-return?subscription_id={subscription_id}&origin=${encodeURIComponent(returnOrigin)}`;

            try {
                // Ensure plan exists on Cashfree
                await ensureCashfreePlan(tier, tierInfo);

                // Create recurring subscription mandate on Cashfree
                const subPayload = {
                    subscription_id: subId,
                    customer_details: {
                        customer_id: user._id.toString(),
                        customer_name: user.name || 'LearnSwap User',
                        customer_email: user.email || 'user@example.com',
                        customer_phone: phone,
                    },
                    plan_details: {
                        plan_id: tierInfo.planId,
                    },
                    authorization_details: {
                        authorization_amount: Number(price.toFixed(2)),
                    },
                    subscription_meta: {
                        return_url: subReturnUrl,
                        notification_channels: ['EMAIL', 'SMS'],
                    },
                    subscription_note: `Autopay Subscription: ${tierInfo.name} Plan (₹${price})`,
                    subscription_tags: {
                        userId: user._id.toString(),
                        tier: tier || '',
                        duration: duration || '',
                        purchaseType: 'premium',
                    },
                };

                console.log(`[Cashfree Autopay] Creating subscription mandate for ${user._id}: ${subId}`);
                const cfSubRes = await axios.post(
                    `${CASHFREE_BASE_URL}/subscriptions`,
                    subPayload,
                    { headers: getCashfreeHeaders() }
                );

                const subData = cfSubRes.data;
                const sessionId = subData.subscription_session_id || subData.payment_session_id;
                const authLink = subData.auth_link || subData.payment_link;

                await PaymentOrder.create({
                    orderId: subId,
                    subscriptionId: subId,
                    subReferenceId: subData.sub_reference_id || subData.cf_subscription_id ? String(subData.sub_reference_id || subData.cf_subscription_id) : null,
                    paymentSessionId: sessionId || null,
                    authLink: authLink || null,
                    planId: tierInfo.planId,
                    isRecurring: true,
                    userId: user._id,
                    purchaseType: 'premium',
                    tier: tier || null,
                    duration: duration || null,
                    amount: Number(price.toFixed(2)),
                    currency: 'INR',
                    status: 'PENDING',
                    gateway: 'cashfree',
                });

                return res.json({
                    success: true,
                    isSubscription: true,
                    orderId: subId,
                    subscriptionId: subId,
                    cfSubscriptionId: subData.cf_subscription_id,
                    subReferenceId: subData.sub_reference_id || subData.cf_subscription_id,
                    authLink: authLink,
                    paymentSessionId: sessionId,
                    subscriptionSessionId: sessionId,
                    amount: Number(price.toFixed(2)),
                    currency: 'INR',
                });
            } catch (subErr) {
                console.error(
                    '[Cashfree Autopay Error]',
                    subErr.response?.data || subErr.message
                );
                // Return clear error if subscription creation fails instead of silently converting to one-time payment
                return res.status(500).json({
                    success: false,
                    message: subErr.response?.data?.message || 'Failed to initiate Cashfree Autopay subscription',
                    error: subErr.response?.data || subErr.message,
                });
            }
        }

        // =========================================================================
        // 2. ONE-TIME PAYMENT ORDER (purchaseType === 'credits' or fallback)
        // =========================================================================
        let price = 0;
        let orderNote = '';

        if (purchaseType === 'credits') {
            const pkg = creditPackages[packageId];
            if (!pkg) {
                return res.status(400).json({ message: 'Invalid packageId' });
            }
            price = pkg.price;
            orderNote = `Top-up: ${pkg.credits + pkg.bonusCredits} Credits Package`;
        } else {
            const tierInfo = premiumTiers[tier];
            price = tierInfo?.price || (duration === 'yearly' ? 1499 : 199);
            orderNote = `Subscription: ${tierInfo?.name || 'Premium'} Plan (₹${price})`;
        }

        const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const returnUrl = `${returnUrlBase}/payments/cashfree-return?order_id={order_id}&origin=${encodeURIComponent(returnOrigin)}`;

        const cashfreePayload = {
            order_id: orderId,
            order_amount: Number(price.toFixed(2)),
            order_currency: 'INR',
            customer_details: {
                customer_id: user._id.toString(),
                customer_name: user.name || 'LearnSwap User',
                customer_email: user.email || 'user@example.com',
                customer_phone: phone,
            },
            order_meta: {
                return_url: returnUrl,
            },
            order_note: orderNote,
            order_tags: {
                userId: user._id.toString(),
                purchaseType: purchaseType,
                packageId: packageId || '',
                tier: tier || '',
                duration: duration || '',
            },
        };

        const cfResponse = await axios.post(
            `${CASHFREE_BASE_URL}/orders`,
            cashfreePayload,
            { headers: getCashfreeHeaders() }
        );

        const cfData = cfResponse.data;

        await PaymentOrder.create({
            orderId: orderId,
            cfOrderId: cfData.cf_order_id ? String(cfData.cf_order_id) : null,
            paymentSessionId: cfData.payment_session_id,
            userId: user._id,
            purchaseType,
            packageId: packageId || null,
            tier: tier || null,
            duration: duration || null,
            amount: Number(price.toFixed(2)),
            currency: 'INR',
            status: 'PENDING',
            gateway: 'cashfree',
        });

        res.json({
            success: true,
            isSubscription: false,
            orderId: orderId,
            cfOrderId: cfData.cf_order_id,
            paymentSessionId: cfData.payment_session_id,
            amount: cfData.order_amount,
            currency: cfData.order_currency,
        });
    } catch (err) {
        console.error('[Create Cashfree Order Error]', err.response?.data || err.message);
        const errMsg = err.response?.data?.message || 'Failed to create payment order';
        res.status(500).json({ message: errMsg, error: err.response?.data || err.message });
    }
});

/**
 * GET /payments/checkout
 * Renders the Cashfree checkout page (handles both Subscription Autopay & One-Time Orders)
 */
router.get('/checkout', async (req, res) => {
    try {
        const { orderId, subscriptionId, paymentSessionId: querySessionId, authLink: queryAuthLink, origin } = req.query;

        // If direct authLink was provided for subscription mandate, redirect immediately to Cashfree Autopay
        if (queryAuthLink) {
            return res.redirect(queryAuthLink);
        }

        const targetId = orderId || subscriptionId;
        if (!targetId) {
            return res.status(400).send('Missing required orderId or subscriptionId for checkout');
        }

        // Look up order record
        const order = await PaymentOrder.findOne({
            $or: [{ orderId: targetId }, { subscriptionId: targetId }]
        });

        // If this is a subscription mandate and we have an authLink, redirect to Cashfree Autopay setup
        if (order && order.isRecurring && order.authLink) {
            return res.redirect(order.authLink);
        }

        let paymentSessionId = querySessionId || order?.paymentSessionId;

        if (!paymentSessionId && order?.orderId) {
            try {
                const cfRes = await axios.get(
                    `${CASHFREE_BASE_URL}/orders/${order.orderId}`,
                    { headers: getCashfreeHeaders() }
                );
                paymentSessionId = cfRes.data?.payment_session_id;
            } catch (e) {
                console.warn('[Checkout lookup error]:', e.message);
            }
        }

        if (!paymentSessionId && order?.authLink) {
            return res.redirect(order.authLink);
        }

        if (!paymentSessionId) {
            return res.status(400).send('Unable to find payment session or authorization link for this order.');
        }

        const mode = CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
        const isSubscription = Boolean(order?.isRecurring || (paymentSessionId && paymentSessionId.startsWith('sub_session_')));

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isSubscription ? 'Cashfree Autopay Setup' : 'Cashfree Checkout'}</title>
    <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
            color: #F8FAFC;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: rgba(30, 41, 59, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(16px);
            border-radius: 20px;
            padding: 36px 28px;
            text-align: center;
            max-width: 420px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }
        .logo-badge {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #6366F1, #8B5CF6);
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            margin-bottom: 20px;
            box-shadow: 0 8px 16px rgba(99, 102, 241, 0.3);
        }
        h2 {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #FFFFFF;
        }
        p {
            font-size: 14px;
            color: #94A3B8;
            margin-bottom: 24px;
            line-height: 1.5;
        }
        .spinner {
            border: 3px solid rgba(255, 255, 255, 0.15);
            border-top-color: #8B5CF6;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 20px auto;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .pay-btn {
            display: inline-block;
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #6366F1, #8B5CF6);
            color: white;
            font-size: 15px;
            font-weight: 600;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        .pay-btn:hover {
            opacity: 0.95;
            transform: translateY(-1px);
        }
        .secure-badge {
            margin-top: 16px;
            font-size: 12px;
            color: #64748B;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .demo-box {
            margin-top: 24px;
            padding-top: 18px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .demo-btn {
            display: inline-block;
            width: 100%;
            padding: 12px;
            background: rgba(99, 102, 241, 0.15);
            border: 1px dashed #818CF8;
            color: #C7D2FE;
            font-size: 13px;
            font-weight: 600;
            border-radius: 12px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s ease;
        }
        .demo-btn:hover {
            background: rgba(99, 102, 241, 0.25);
            color: #FFFFFF;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo-badge">💳</div>
        <h2>${isSubscription ? 'Opening Autopay Mandate' : 'Opening Payment Gateway'}</h2>
        <p>${isSubscription ? 'Setting up your automated recurring subscription with Cashfree.' : 'Connecting securely with Cashfree. Please complete the payment in the window.'}</p>
        <div class="spinner" id="spinner"></div>
        <button id="payButton" class="pay-btn" style="display:none;" onclick="triggerCheckout()">Proceed to Pay</button>
        <div class="secure-badge">
            🔒 256-Bit SSL Encrypted & PCI-DSS Compliant
        </div>
        <div class="demo-box">
            <a href="/payments/demo-fulfill?orderId=${encodeURIComponent(targetId)}&origin=${encodeURIComponent(origin || '')}" class="demo-btn">
                ⚡ Demo / Sandbox Quick Pay (Simulate Success)
            </a>
        </div>
    </div>

    <script>
        const paymentSessionId = "${paymentSessionId}";
        const isSubscription = ${isSubscription ? 'true' : 'false'};
        const cashfree = Cashfree({
            mode: "${mode}"
        });

        function triggerCheckout() {
            if (isSubscription) {
                if (typeof cashfree.subscriptionsCheckout === 'function') {
                    cashfree.subscriptionsCheckout({
                        subsSessionId: paymentSessionId,
                        redirectTarget: "_self"
                    });
                } else {
                    cashfree.checkout({
                        paymentSessionId: paymentSessionId,
                        redirectTarget: "_self"
                    });
                }
            } else {
                cashfree.checkout({
                    paymentSessionId: paymentSessionId,
                    redirectTarget: "_self"
                });
            }
        }

        // Auto initiate checkout
        window.addEventListener('load', function() {
            try {
                triggerCheckout();
            } catch (err) {
                console.error("Auto checkout error:", err);
                document.getElementById('spinner').style.display = 'none';
                document.getElementById('payButton').style.display = 'block';
            }
        });

        // Show button fallback after 4 seconds if redirect didn't happen
        setTimeout(function() {
            const btn = document.getElementById('payButton');
            if (btn) btn.style.display = 'block';
        }, 4000);
    </script>
</body>
</html>
        `;
        res.send(htmlContent);
    } catch (err) {
        console.error('[Checkout Page Error]', err);
        res.status(500).send('Server error rendering Cashfree checkout');
    }
});

/**
 * GET /payments/subscription-return
 * Callback after user authorizes or cancels Cashfree recurring Autopay mandate
 */
router.get('/subscription-return', async (req, res) => {
    try {
        const { subscription_id, origin } = req.query;

        if (!subscription_id) {
            return res.redirect(`/payments/failed?message=Missing%20subscription%20reference&origin=${encodeURIComponent(origin || '')}`);
        }

        console.log(`[Cashfree Autopay Return] Processing return for subscription: ${subscription_id}`);

        // Fetch subscription status from Cashfree Subscriptions API
        const cfRes = await axios.get(
            `${CASHFREE_BASE_URL}/subscriptions/${subscription_id}`,
            { headers: getCashfreeHeaders() }
        );

        const cfSub = cfRes.data;
        const status = cfSub.subscription_status || cfSub.status;

        console.log(`[Cashfree Autopay Return] Subscription ${subscription_id} status: ${status}`);

        // ACTIVE, INITIALIZED with auth successful, or BANK_APPROVAL_PENDING
        if (status === 'ACTIVE' || status === 'COMPLETED' || status === 'BANK_APPROVAL_PENDING' || status === 'INITIALIZED') {
            const result = await fulfillSubscription(subscription_id, cfSub);
            if (result.success) {
                return res.redirect(`/payments/success?origin=${encodeURIComponent(origin || '')}&subscription_id=${encodeURIComponent(subscription_id)}&type=subscription`);
            } else {
                return res.redirect(`/payments/failed?message=${encodeURIComponent(result.message || 'Error activating subscription')}&origin=${encodeURIComponent(origin || '')}`);
            }
        } else if (status === 'CANCELLED' || status === 'USER_DROPPED') {
            await PaymentOrder.updateOne({ subscriptionId: subscription_id }, { status: 'CANCELLED', paymentDetails: cfSub });
            return res.redirect(`/payments/failed?message=Autopay%20setup%20was%20cancelled&origin=${encodeURIComponent(origin || '')}`);
        } else {
            await PaymentOrder.updateOne({ subscriptionId: subscription_id }, { status: status || 'FAILED', paymentDetails: cfSub });
            return res.redirect(`/payments/failed?message=${encodeURIComponent(`Subscription status: ${status}`)}&origin=${encodeURIComponent(origin || '')}`);
        }
    } catch (err) {
        console.error('[Cashfree Autopay Return Error]', err.response?.data || err.message);
        const origin = req.query.origin || '';
        return res.redirect(`/payments/failed?message=${encodeURIComponent(err.message || 'Autopay authorization failed')}&origin=${encodeURIComponent(origin)}`);
    }
});

/**
 * GET /payments/cashfree-return
 * Return URL callback after user completes / cancels Cashfree one-time payment
 */
router.get('/cashfree-return', async (req, res) => {
    try {
        const { order_id, origin } = req.query;

        if (!order_id) {
            return res.redirect(`/payments/failed?message=Missing%20order%20reference&origin=${encodeURIComponent(origin || '')}`);
        }

        console.log(`[Cashfree Return] Processing return for order: ${order_id}`);

        // Fetch order details from Cashfree PG
        const cfRes = await axios.get(
            `${CASHFREE_BASE_URL}/orders/${order_id}`,
            { headers: getCashfreeHeaders() }
        );

        const cfOrder = cfRes.data;
        const status = cfOrder.order_status;

        console.log(`[Cashfree Return] Order ${order_id} status from Cashfree: ${status}`);

        if (status === 'PAID') {
            const result = await fulfillPaymentOrder(order_id, cfOrder);
            if (result.success) {
                return res.redirect(`/payments/success?origin=${encodeURIComponent(origin || '')}&order_id=${encodeURIComponent(order_id)}`);
            } else {
                return res.redirect(`/payments/failed?message=${encodeURIComponent(result.message || 'Error crediting account')}&origin=${encodeURIComponent(origin || '')}`);
            }
        } else if (status === 'USER_DROPPED' || status === 'CANCELLED') {
            await PaymentOrder.updateOne({ orderId: order_id }, { status: 'CANCELLED', paymentDetails: cfOrder });
            return res.redirect(`/payments/failed?message=Payment%20was%20cancelled&origin=${encodeURIComponent(origin || '')}`);
        } else {
            await PaymentOrder.updateOne({ orderId: order_id }, { status: status || 'FAILED', paymentDetails: cfOrder });
            return res.redirect(`/payments/failed?message=${encodeURIComponent(`Payment status: ${status}`)}&origin=${encodeURIComponent(origin || '')}`);
        }
    } catch (err) {
        console.error('[Cashfree Return Error]', err.response?.data || err.message);
        const origin = req.query.origin || '';
        return res.redirect(`/payments/failed?message=${encodeURIComponent(err.message || 'Payment verification failed')}&origin=${encodeURIComponent(origin)}`);
    }
});

/**
 * POST /payments/verify
 * Programmatic verification endpoint for client/app
 */
router.post('/verify', async (req, res) => {
    try {
        const { orderId, subscriptionId } = req.body;
        const targetId = orderId || subscriptionId;

        if (!targetId) {
            return res.status(400).json({ success: false, message: 'Missing orderId or subscriptionId' });
        }

        const order = await PaymentOrder.findOne({
            $or: [{ orderId: targetId }, { subscriptionId: targetId }]
        });

        if (order && order.isRecurring) {
            const cfRes = await axios.get(
                `${CASHFREE_BASE_URL}/subscriptions/${order.subscriptionId || targetId}`,
                { headers: getCashfreeHeaders() }
            );
            const cfSub = cfRes.data;
            const status = cfSub.subscription_status || cfSub.status;

            if (status === 'ACTIVE' || status === 'COMPLETED' || status === 'BANK_APPROVAL_PENDING' || status === 'INITIALIZED') {
                const result = await fulfillSubscription(order.subscriptionId || targetId, cfSub);
                return res.json({
                    success: true,
                    status: 'ACTIVE',
                    isSubscription: true,
                    user: result.user,
                });
            }
            return res.json({
                success: false,
                status: status,
                message: `Subscription status is ${status}`,
            });
        }

        // One-time order verification
        const cfRes = await axios.get(
            `${CASHFREE_BASE_URL}/orders/${targetId}`,
            { headers: getCashfreeHeaders() }
        );

        const cfOrder = cfRes.data;
        if (cfOrder.order_status === 'PAID') {
            const result = await fulfillPaymentOrder(targetId, cfOrder);
            return res.json({
                success: true,
                status: 'PAID',
                user: result.user,
            });
        }

        res.json({
            success: false,
            status: cfOrder.order_status,
            message: `Payment status is ${cfOrder.order_status}`,
        });
    } catch (err) {
        console.error('[Verify Cashfree Payment Error]', err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Verification server error' });
    }
});

/**
 * ALL /payments/demo-fulfill
 * Demo / Sandbox simulation endpoint for testing
 */
router.all('/demo-fulfill', async (req, res) => {
    try {
        const orderId = req.query.orderId || req.body?.orderId || req.query.order_id || req.body?.order_id;
        const subscriptionId = req.query.subscriptionId || req.body?.subscriptionId || req.query.subscription_id || req.body?.subscription_id;
        const origin = req.query.origin || req.body?.origin || '';
        const targetId = orderId || subscriptionId;

        if (!targetId) {
            return res.status(400).json({ success: false, message: 'Missing orderId or subscriptionId' });
        }

        const order = await PaymentOrder.findOne({
            $or: [{ orderId: targetId }, { subscriptionId: targetId }]
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        let result;
        if (order.isRecurring) {
            result = await fulfillSubscription(targetId, { simulated: true, mode: 'demo' });
        } else {
            result = await fulfillPaymentOrder(targetId, { simulated: true, mode: 'demo' });
        }

        if (req.method === 'GET') {
            if (result.success) {
                return res.redirect(`/payments/success?origin=${encodeURIComponent(origin)}&order_id=${encodeURIComponent(targetId)}&type=${order.isRecurring ? 'subscription' : 'credits'}`);
            } else {
                return res.redirect(`/payments/failed?message=${encodeURIComponent(result.message || 'Demo payment failed')}&origin=${encodeURIComponent(origin)}`);
            }
        }

        res.json({ success: result.success, user: result.user });
    } catch (err) {
        console.error('[Demo Fulfill Error]', err);
        if (req.method === 'GET') {
            return res.redirect(`/payments/failed?message=${encodeURIComponent(err.message)}`);
        }
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /payments/cashfree-webhook
 * Webhook handler for async notifications from Cashfree (Subscriptions & Orders)
 */
router.post(['/cashfree-webhook', '/webhook'], async (req, res) => {
    try {
        const eventType = req.body?.type || req.body?.event;
        const eventData = req.body?.data;

        console.log(`[Cashfree Webhook] Event received: ${eventType || 'unknown'}`);

        // Handle Subscription Webhook events
        const subId = eventData?.subscription?.subscription_id || eventData?.subscription_id || req.body?.subscription_id;
        const subStatus = eventData?.subscription?.subscription_status || eventData?.subscription_status || req.body?.subscription_status;

        if (subId && (subStatus === 'ACTIVE' || eventType === 'SUBSCRIPTION_PAYMENT_SUCCESS' || eventType === 'SUBSCRIPTION_ACTIVATED' || eventType === 'SUBSCRIPTION_CHARGED')) {
            console.log(`[Cashfree Webhook] Fulfilling subscription ${subId}`);
            await fulfillSubscription(subId, req.body);
            return res.status(200).json({ status: 'OK' });
        }

        // Handle Order Webhook events
        const orderId = eventData?.order?.order_id || req.body?.order_id;
        const orderStatus = eventData?.order?.order_status || req.body?.order_status;

        if (orderId && orderStatus === 'PAID') {
            await fulfillPaymentOrder(orderId, req.body);
        }

        res.status(200).json({ status: 'OK' });
    } catch (err) {
        console.error('[Cashfree Webhook Error]', err);
        res.status(200).json({ status: 'ERROR', message: err.message });
    }
});

/**
 * GET /payments/success
 */
router.get('/success', (req, res) => {
    const origin = req.query.origin || '';
    const type = req.query.type || '';
    const isSub = type === 'subscription' || Boolean(req.query.subscription_id);
    const title = isSub ? 'Autopay Subscription Activated! 🎉' : 'Payment Successful! 🎉';
    const desc = isSub
        ? 'Your membership is now active with automated renewals and bonus credits credited!'
        : 'Your credits have been added to your account!';

    const redirectButtonHtml = origin
        ? `<a href="${origin}/store" style="display:inline-block; text-decoration:none; background:linear-gradient(135deg, #6366F1, #8B5CF6); color:white; padding:12px 28px; border-radius:10px; font-weight:600; margin-top:20px; box-shadow:0 4px 12px rgba(99, 102, 241, 0.3);">Return to App</a>`
        : `<p style="color: #94A3B8; font-size: 13px; font-style: italic; margin-top: 20px;">You can now close this window and return to the app.</p>`;

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
            color: #F8FAFC;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            margin: 0;
        }
        .card {
            background: rgba(30, 41, 59, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(16px);
            border-radius: 20px;
            padding: 40px 28px;
            text-align: center;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }
        .icon {
            width: 64px;
            height: 64px;
            background: rgba(16, 185, 129, 0.15);
            border: 2px solid #10B981;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            color: #10B981;
            margin-bottom: 20px;
        }
        h2 { font-size: 22px; color: #FFFFFF; margin-bottom: 8px; font-weight: 700; }
        p { color: #94A3B8; font-size: 14px; margin-bottom: 12px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">✓</div>
        <h2>${title}</h2>
        <p>${desc}</p>
        ${redirectButtonHtml}
    </div>
</body>
</html>
    `);
});

/**
 * GET /payments/failed
 */
router.get('/failed', (req, res) => {
    const message = req.query.message || 'Payment could not be completed.';
    const origin = req.query.origin || '';
    const redirectButtonHtml = origin
        ? `<a href="${origin}/store" style="display:inline-block; text-decoration:none; background:#EF4444; color:white; padding:12px 28px; border-radius:10px; font-weight:600; margin-top:20px; box-shadow:0 4px 12px rgba(239, 68, 68, 0.3);">Return to Store</a>`
        : `<p style="color: #94A3B8; font-size: 13px; font-style: italic; margin-top: 20px;">You can now close this window and return to the app.</p>`;

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Failed</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
            color: #F8FAFC;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            margin: 0;
        }
        .card {
            background: rgba(30, 41, 59, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(16px);
            border-radius: 20px;
            padding: 40px 28px;
            text-align: center;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }
        .icon {
            width: 64px;
            height: 64px;
            background: rgba(239, 68, 68, 0.15);
            border: 2px solid #EF4444;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            color: #EF4444;
            margin-bottom: 20px;
        }
        h2 { font-size: 22px; color: #FFFFFF; margin-bottom: 8px; font-weight: 700; }
        p { color: #94A3B8; font-size: 14px; margin-bottom: 12px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">✗</div>
        <h2>Payment Failed</h2>
        <p>${message}</p>
        ${redirectButtonHtml}
    </div>
</body>
</html>
    `);
});

module.exports = router;
