const express = require('express');
const router = express.Router();
const SkillSwap = require('../../models/SkillSwap');
const User = require('../../models/User');
const PointTransaction = require('../../models/PointTransaction');
const mongoose = require('mongoose');
const { emitToUser, broadcastEvent } = require('../../socket');
const { isBlockedBetween } = require('../user');

function notifySwapUsers(swap) {
    if (!swap) return;
    const reqId = String(swap.requesterId?._id || swap.requesterId || '');
    const recId = String(swap.recipientId?._id || swap.recipientId || '');
    if (reqId) {
        emitToUser(reqId, 'swap_updated', swap);
        emitToUser(reqId, 'credits_updated', { userId: reqId });
    }
    if (recId) {
        emitToUser(recId, 'swap_updated', swap);
        emitToUser(recId, 'credits_updated', { userId: recId });
    }
    broadcastEvent('swap_updated', swap);
}

/**
 * 🔄 Auto debit monthly credits from learner's account for active monthly subscription swaps that are NOT completed
 */
async function processMonthlyAutoDebits(targetSwapId = null, force = false) {
    try {
        const Skill = require('../../models/Skill');
        const query = { status: { $nin: ['completed', 'declined'] } };
        if (targetSwapId) {
            query._id = targetSwapId;
        }
        const activeSwaps = await SkillSwap.find(query);

        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const now = new Date();
        let processedCount = 0;

        for (const swap of activeSwaps) {
            const swapType = swap.swapType || 'swap';
            let studentId = null;
            let teacherId = null;
            let targetSkillId = null;

            const extractId = (val) => {
                if (!val) return null;
                if (typeof val === 'object' && val._id) return String(val._id);
                return String(val);
            };

            if (swapType === 'learn') {
                studentId = extractId(swap.requesterId);
                teacherId = extractId(swap.recipientId);
                targetSkillId = extractId(swap.recipientSkillId);
            } else if (swapType === 'teach') {
                studentId = extractId(swap.recipientId);
                teacherId = extractId(swap.requesterId);
                targetSkillId = extractId(swap.requesterSkillId);
            } else {
                studentId = extractId(swap.requesterId);
                teacherId = extractId(swap.recipientId);
                targetSkillId = extractId(swap.recipientSkillId);
            }

            if (!targetSkillId || !studentId) continue;

            const skill = await Skill.findById(targetSkillId);
            if (!skill || skill.pricingModel !== 'monthly' || !skill.monthlyPrice || skill.monthlyPrice <= 0) {
                continue;
            }

            const monthlyCost = skill.monthlyPrice;
            const lastDebit = swap.lastAutoDebitedAt ? new Date(swap.lastAutoDebitedAt) : new Date(swap.createdAt);
            const elapsed = now.getTime() - lastDebit.getTime();

            // Auto debit if 30 days passed or if force is true
            if (force || elapsed >= THIRTY_DAYS_MS) {
                const student = await User.findById(studentId);
                if (student) {
                    student.credits = Math.max(0, (student.credits || 0) - monthlyCost);
                    await student.save();

                    await PointTransaction.create({
                        userId: studentId,
                        amount: monthlyCost,
                        type: 'redeemed',
                        source: 'monthly_subscription_autodebit',
                        description: `Auto-debited monthly subscription for "${skill.title}"`,
                        swapId: swap._id,
                    });

                    if (teacherId) {
                        const teacherEarned = Math.round(monthlyCost * 0.8);
                        await PointTransaction.create({
                            userId: teacherId,
                            amount: teacherEarned,
                            type: 'earned',
                            source: 'monthly_subscription_payout',
                            description: `Monthly subscription earnings for "${skill.title}" (80% of ${monthlyCost} cr)`,
                            swapId: swap._id,
                        });
                    }

                    swap.negotiationNotes.push({
                        authorId: studentId,
                        body: `Monthly subscription auto-debited: ${monthlyCost} credits deducted for ongoing monthly session "${skill.title}".`,
                        isSystem: true,
                        createdAt: now,
                    });

                    swap.lastAutoDebitedAt = now;
                    swap.updatedAt = now;
                    await swap.save();

                    notifySwapUsers(swap);
                    processedCount++;
                }
            }
        }
        return processedCount;
    } catch (err) {
        console.error('[Monthly AutoDebit Error]', err);
        return 0;
    }
}

// POST /api/swaps
router.post('/', async (req, res) => {
    try {
        const {
            requesterId,
            requesterSkillId,
            recipientId,
            recipientSkillId,
            proposedTimes,
            locationPreference,
            message,
            swapType,
        } = req.body;

        // swapType defaults to 'swap' if not provided (backward compat)
        const resolvedSwapType = swapType || 'swap';

        if (!requesterId || !recipientId || !recipientSkillId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Validate if either user has blocked the other
        const isBlocked = await isBlockedBetween(requesterId, recipientId);
        if (isBlocked) {
            return res.status(403).json({ message: 'Cannot request skill exchange with a user who is blocked or has blocked you.' });
        }

        // For 'teach' and 'swap', requesterSkillId is required
        if ((resolvedSwapType === 'teach' || resolvedSwapType === 'swap') && !requesterSkillId) {
            return res.status(400).json({ message: 'requesterSkillId is required for teach/swap requests' });
        }

        const requester = await User.findById(requesterId);
        if (!requester) {
            return res.status(404).json({ message: 'Requester user not found' });
        }

        // Credit logic:
        // - 'teach': teacher pays nothing (they earn on completion)
        // - 'learn': learner pays 3 credits platform fee (free tier) or 0 (premium)
        // - 'swap': requester pays 3 credits platform fee (free tier) or 0 (premium)
        const isPayingRole = resolvedSwapType === 'learn' || resolvedSwapType === 'swap';
        const swapCost = isPayingRole && requester.premiumTier === 'free' ? 3 : 0;
        if (swapCost > 0) {
            if ((requester.credits || 0) < swapCost) {
                return res.status(400).json({ message: `Insufficient credits to start a swap. You need ${swapCost} credits.` });
            }
            requester.credits = (requester.credits || 0) - swapCost;
            await requester.save();
        }


        const negotiationNotes = [];

        if (message && message.trim().length > 0) {
            negotiationNotes.push({
                authorId: requesterId,
                body: message,
                isSystem: false,
            });
        }

        const formattedProposedTimes = (proposedTimes || []).map((slot) => ({
            proposedById: slot.proposedById || requesterId,
            startISO: new Date(slot.startISO),
            endISO: new Date(slot.endISO),
            status: slot.status || 'pending',
        }));

        const swap = await SkillSwap.create({
            requesterId,
            requesterSkillId: requesterSkillId || null,
            recipientId,
            recipientSkillId,
            swapType: resolvedSwapType,
            locationPreference,
            proposedTimes: formattedProposedTimes,
            negotiationNotes,
            status: 'pending',
        });

        const requesterName = requester?.name || 'A community member';
        emitToUser(recipientId.toString(), 'new_notification', {
            category: 'swap',
            title: 'New exchange request',
            body: `${requesterName} sent you a new skill exchange request. Review their proposal now.`,
            metadata: {
                swapId: swap._id.toString(),
                type: 'swap-action',
            },
        });

        notifySwapUsers(swap);

        return res.json({
            id: swap._id,
            requesterId: swap.requesterId,
            requesterSkillId: swap.requesterSkillId,
            recipientId: swap.recipientId,
            recipientSkillId: swap.recipientSkillId,
            swapType: swap.swapType,
            locationPreference: swap.locationPreference,
            proposedTimes: swap.proposedTimes,
            negotiationNotes: swap.negotiationNotes,
            status: swap.status,
        });
    } catch (error) {
        console.error('Create swap error:', error);
        return res.status(500).json({ message: 'Failed to create swap' });
    }
});






// POST /api/swaps/process-monthly-debits
router.post('/process-monthly-debits', async (req, res) => {
    try {
        const count = await processMonthlyAutoDebits(null, req.body.force === true);
        res.json({ success: true, processedCount: count, message: `Processed ${count} monthly subscription debits` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/swaps/:id/trigger-monthly-debit
router.post('/:id/trigger-monthly-debit', async (req, res) => {
    try {
        const { id } = req.params;
        const count = await processMonthlyAutoDebits(id, true);
        const swap = await SkillSwap.findById(id);
        res.json({ success: true, processedCount: count, swap });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/swaps?userId=xxx
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.json([]);
        }

        // Trigger background monthly subscription check
        processMonthlyAutoDebits().catch((err) => console.error('Background monthly debit check error:', err));

        const swaps = await SkillSwap.find({
            $or: [{ requesterId: userId }, { recipientId: userId }],
        })
            .sort({ updatedAt: -1 })
            .lean();

        return res.json(swaps);
    } catch (error) {
        console.error('Fetch swaps error:', error);
        return res.status(500).json({ message: 'Failed to fetch swaps' });
    }
});


// GET /api/swaps
router.get('/all', async (req, res) => {
    try {
        processMonthlyAutoDebits().catch((err) => console.error('Background monthly debit check error:', err));

        const swaps = await SkillSwap.find()
            .sort({ updatedAt: -1 })
            .lean();

        return res.json(swaps);
    } catch (error) {
        console.error('Fetch swaps error:', error);
        return res.status(500).json({ message: 'Failed to fetch swaps' });
    }
});

// PATCH /api/swaps/:id/location
router.patch('/:id/location', async (req, res) => {
    try {
        const { id } = req.params;
        const { location } = req.body;

        if (!location) {
            return res.status(400).json({ message: 'location is required' });
        }

        const updatedSwap = await SkillSwap.findByIdAndUpdate(
            id,
            {
                locationPreference: location,
                updatedAt: new Date(),
                $push: {
                    negotiationNotes: {
                        authorId: req.body.authorId,
                        body: `Location updated to ${location}`,
                        isSystem: true,
                        createdAt: new Date(),
                    },
                },
            },
            { new: true }
        );

        if (!updatedSwap) {
            return res.status(404).json({ message: 'Swap not found' });
        }

        const reqId = String(updatedSwap.requesterId?._id || updatedSwap.requesterId || '');
        const recId = String(updatedSwap.recipientId?._id || updatedSwap.recipientId || '');
        const authorId = req.body.authorId;
        const partnerId = String(authorId) === reqId ? recId : (String(authorId) === recId ? reqId : (recId || reqId));
        const author = authorId ? await User.findById(authorId) : null;
        const authorName = author?.name || 'Your partner';

        if (partnerId) {
            emitToUser(partnerId, 'new_notification', {
                category: 'swap',
                title: 'Location updated',
                body: `${authorName} updated the exchange location to: ${location}`,
                metadata: {
                    swapId: updatedSwap._id.toString(),
                    type: 'swap-action',
                },
            });
        }

        notifySwapUsers(updatedSwap);
        res.json(updatedSwap);
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ message: 'Failed to update location' });
    }
});


// POST /api/swaps/:id/messages
router.post('/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const { authorId, body, isSystem = false } = req.body;

        if (!authorId || !body) {
            return res.status(400).json({ message: 'authorId and body are required' });
        }

        const message = {
            authorId,
            body,
            isSystem,
            createdAt: new Date(),
        };

        const updatedSwap = await SkillSwap.findByIdAndUpdate(
            id,
            {
                $push: { negotiationNotes: message },
                updatedAt: new Date(),
            },
            { new: true }
        );

        if (!updatedSwap) {
            return res.status(404).json({ message: 'Swap not found' });
        }

        const reqId = String(updatedSwap.requesterId?._id || updatedSwap.requesterId || '');
        const recId = String(updatedSwap.recipientId?._id || updatedSwap.recipientId || '');
        const partnerId = reqId === String(authorId) ? recId : reqId;
        const author = await User.findById(authorId);
        const authorName = author?.name || 'Your partner';

        if (partnerId && !isSystem) {
            emitToUser(partnerId, 'new_notification', {
                category: 'swap',
                title: `New message from ${authorName}`,
                body,
                metadata: {
                    swapId: updatedSwap._id.toString(),
                    type: 'chat-message',
                    authorId: String(authorId),
                    authorName,
                },
            });
        }

        notifySwapUsers(updatedSwap);
        res.json(updatedSwap);
    } catch (error) {
        console.error('Add message error:', error);
        res.status(500).json({ message: 'Failed to add message' });
    }
});

// PATCH /api/swaps/:id/accept-proposal
router.patch('/:id/accept-proposal', async (req, res) => {
    try {
        const { id } = req.params;
        const { timeId, location, authorId, note } = req.body;



        const swap = await SkillSwap.findById(id);
        if (!swap) {
            return res.status(404).json({ message: 'Swap not found' });
        }

        // Validate that user is NOT accepting their own proposed slot
        const targetSlot = swap.proposedTimes.find((slot) => String(slot._id) === String(timeId) || String(slot.id) === String(timeId));
        if (targetSlot) {
            const slotProposerId = String(targetSlot.proposedById?._id || targetSlot.proposedById || swap.requesterId?._id || swap.requesterId || '');
            if (slotProposerId && authorId && slotProposerId === String(authorId)) {
                return res.status(400).json({
                    message: 'You cannot accept your own proposed time slot. Your exchange partner must accept or decline it.',
                });
            }
        }

        const isRequester = swap.requesterId.toString() === authorId.toString();
        const swapType = swap.swapType || 'swap';

        // Learner (recipient in 'teach') or Skill Swapper (recipient in 'swap') pays 5 credits on accept
        const isPayingAcceptor =
            (swapType === 'teach' && !isRequester) ||
            (swapType === 'swap' && !isRequester);

        if (isPayingAcceptor && !swap.recipientPaid) {
            const acceptingUser = await User.findById(authorId);
            if (acceptingUser) {
                const cost = acceptingUser.premiumTier === 'free' ? 5 : 0;
                if (cost > 0) {
                    if ((acceptingUser.credits || 0) < cost) {
                        return res.status(400).json({
                            message: `Insufficient credits. You need ${cost} credits to accept this swap request.`,
                        });
                    }
                    acceptingUser.credits = (acceptingUser.credits || 0) - cost;
                    await acceptingUser.save();
                }
                swap.recipientPaid = true;
            }
        }

        // update proposed times
        swap.proposedTimes = swap.proposedTimes.map((slot) => {
            if (slot._id.toString() === timeId || (slot.id && slot.id.toString() === timeId)) {
                slot.status = 'accepted';
            } else {
                slot.status = 'declined';
            }
            return slot;
        });

        if (timeId) {
            swap.acceptedTimeId = timeId;
        }

        swap.status = 'scheduled';

        if (location) {
            swap.locationPreference = location;
        }

        // system messages
        if (location) {
            swap.negotiationNotes.push({
                authorId,
                body: `Location set to ${location}`,
                isSystem: true,
                createdAt: new Date(),
            });
        }

        swap.negotiationNotes.push({
            authorId,
            body: 'Swap confirmed! See you soon.',
            isSystem: true,
            createdAt: new Date(),
        });

        if (note) {
            swap.negotiationNotes.push({
                authorId,
                body: note,
                isSystem: false,
                createdAt: new Date(),
            });
        }

        swap.updatedAt = new Date();
        await swap.save();

        const reqId = String(swap.requesterId?._id || swap.requesterId || '');
        const recId = String(swap.recipientId?._id || swap.recipientId || '');
        const partnerId = reqId === String(authorId) ? recId : reqId;
        const author = await User.findById(authorId);
        const authorName = author?.name || 'Your partner';

        if (partnerId) {
            emitToUser(partnerId, 'new_notification', {
                category: 'swap',
                title: 'Exchange confirmed',
                body: `Your session with ${authorName} is confirmed! Add it to your calendar and get ready.`,
                metadata: {
                    swapId: swap._id.toString(),
                    type: 'swap-action',
                },
            });
        }

        notifySwapUsers(swap);
        res.json(swap);
    } catch (error) {
        console.error('Accept proposal error:', error);
        res.status(500).json({ message: 'Failed to accept proposal' });
    }
});

// PATCH /api/swaps/:id/decline-slot
router.patch('/:id/decline-slot', async (req, res) => {
    try {
        const { id } = req.params;
        const { slotId, authorId } = req.body;

        const swap = await SkillSwap.findById(id);
        if (!swap) {
            return res.status(404).json({ message: 'Swap not found' });
        }

        let declinedSlot = null;
        swap.proposedTimes = swap.proposedTimes.map((slot) => {
            if (String(slot._id) === String(slotId) || String(slot.id) === String(slotId)) {
                slot.status = 'declined';
                declinedSlot = slot;
            }
            return slot;
        });

        if (declinedSlot) {
            swap.negotiationNotes.push({
                authorId,
                body: `Declined proposed time slot: ${new Date(declinedSlot.startISO).toLocaleString()}`,
                isSystem: true,
                createdAt: new Date(),
            });
        }

        const hasPending = swap.proposedTimes.some((s) => s.status === 'pending');
        const hasAccepted = swap.proposedTimes.some((s) => s.status === 'accepted');
        if (!hasPending && !hasAccepted) {
            swap.status = 'negotiating';
        }

        swap.updatedAt = new Date();
        await swap.save();

        const reqId = String(swap.requesterId?._id || swap.requesterId || '');
        const recId = String(swap.recipientId?._id || swap.recipientId || '');
        const partnerId = reqId === String(authorId) ? recId : reqId;
        const author = await User.findById(authorId);
        const authorName = author?.name || 'Your partner';

        if (partnerId) {
            emitToUser(partnerId, 'new_notification', {
                category: 'swap',
                title: 'Time slot declined',
                body: `${authorName} declined a proposed time slot.`,
                metadata: {
                    swapId: swap._id.toString(),
                    type: 'swap-action',
                },
            });
        }

        notifySwapUsers(swap);
        res.json(swap);
    } catch (error) {
        console.error('Decline slot error:', error);
        res.status(500).json({ message: 'Failed to decline slot' });
    }
});



// PATCH /api/swaps/:id/counter-proposal
router.patch('/:id/counter-proposal', async (req, res) => {
    try {
        const { id } = req.params;
        const { proposerId, slots, message } = req.body;

        if (!proposerId || !Array.isArray(slots) || slots.length === 0) {
            return res.status(400).json({
                message: 'proposerId and slots[] are required',
            });
        }

        const swap = await SkillSwap.findById(id);
        if (!swap) {
            return res.status(404).json({ message: 'Swap not found' });
        }

        // map incoming slots → SwapTimeProposal
        const newSlots = slots.map((slot) => ({
            proposedById: proposerId,
            startISO: new Date(slot.startISO),
            endISO: new Date(slot.endISO),
            status: 'pending',
        }));

        swap.proposedTimes.push(...newSlots);
        swap.status = 'negotiating';

        if (message) {
            swap.negotiationNotes.push({
                authorId: proposerId,
                body: message,
                isSystem: false,
                createdAt: new Date(),
            });
        }

        swap.updatedAt = new Date();
        await swap.save();

        const reqId = String(swap.requesterId?._id || swap.requesterId || '');
        const recId = String(swap.recipientId?._id || swap.recipientId || '');
        const partnerId = reqId === String(proposerId) ? recId : reqId;
        const author = await User.findById(proposerId);
        const authorName = author?.name || 'Your partner';

        if (partnerId) {
            emitToUser(partnerId, 'new_notification', {
                category: 'swap',
                title: 'Counter proposal received',
                body: `${authorName} shared new time options for your exchange.`,
                metadata: {
                    swapId: swap._id.toString(),
                    type: 'swap-action',
                },
            });
        }

        notifySwapUsers(swap);
        res.json(swap);
    } catch (error) {
        console.error('Counter proposal error:', error);
        res.status(500).json({ message: 'Failed to counter proposal' });
    }
});


// PATCH /api/swaps/:id/calendar-event
router.patch('/:id/calendar-event', async (req, res) => {
    try {
        const { id } = req.params;
        const { calendarEventId } = req.body;

        if (!calendarEventId) {
            return res.status(400).json({
                message: 'calendarEventId is required',
            });
        }

        const swap = await SkillSwap.findById(id);
        if (!swap) {
            return res.status(404).json({ message: 'Swap not found' });
        }

        swap.calendarEventId = calendarEventId;
        swap.updatedAt = new Date();

        await swap.save();

        res.json(swap);
    } catch (error) {
        console.error('Set calendar event error:', error);
        res.status(500).json({ message: 'Failed to set calendar event ID' });
    }
});


// PATCH /api/swaps/:id/complete
router.patch('/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const swap = await SkillSwap.findById(id);
        if (!swap) {
            return res.status(404).json({ message: 'Swap not found' });
        }

        const wasAlreadyCompleted = swap.status === 'completed';
        swap.status = 'completed';
        swap.updatedAt = new Date();

        // system message
        swap.negotiationNotes.push({
            authorId: userId,
            body: 'Skill swap marked as completed.',
            isSystem: true,
            createdAt: new Date(),
        });

        await swap.save();

        // 🏆 Automatically process credits if swap completed for the first time
        if (!wasAlreadyCompleted) {
            const Skill = require('../../models/Skill');
            const swapType = swap.swapType || 'swap';
            let teacherId = null;
            let studentId = null;
            let taughtSkillId = null;

            const extractId = (val) => {
                if (!val) return null;
                if (typeof val === 'object' && val._id) return String(val._id);
                return String(val);
            };

            if (swapType === 'teach') {
                teacherId = extractId(swap.requesterId);
                studentId = extractId(swap.recipientId);
                taughtSkillId = extractId(swap.requesterSkillId);
            } else if (swapType === 'learn') {
                teacherId = extractId(swap.recipientId);
                studentId = extractId(swap.requesterId);
                taughtSkillId = extractId(swap.recipientSkillId);
            } else {
                // 'swap' mode — recipient is teacher, requester is student
                teacherId = extractId(swap.recipientId);
                studentId = extractId(swap.requesterId);
                taughtSkillId = extractId(swap.recipientSkillId);
            }

            // Fetch skill to determine session cost
            let sessionCredits = 0;
            let skillTitle = 'skill session';
            if (taughtSkillId) {
                const taughtSkill = await Skill.findById(taughtSkillId);
                if (taughtSkill) {
                    skillTitle = taughtSkill.title || 'skill session';
                    if (taughtSkill.pricingModel === 'per_session') {
                        sessionCredits = taughtSkill.pricePerSession || 0;
                    } else if (taughtSkill.pricingModel === 'monthly') {
                        sessionCredits = taughtSkill.monthlyPrice || 0;
                    }
                }
            }

            const teacherEarned = sessionCredits > 0 ? Math.round(sessionCredits * 0.8) : 50;
            const learnerBonus = 10;

            // 1. Process Learner (Deduct session cost from main balance, record +10 bonus in earnings only)
            if (studentId) {
                if (sessionCredits > 0) {
                    const student = await User.findById(studentId);
                    if (student) {
                        student.credits = Math.max(0, (student.credits || 0) - sessionCredits);
                        await student.save();
                        await PointTransaction.create({
                            userId: studentId,
                            amount: sessionCredits,
                            type: 'redeemed',
                            source: 'swap_completed',
                            description: `Session fee for "${skillTitle}"`,
                            swapId: swap._id,
                        });
                    }
                }

                // Learner completion bonus — goes to earnings/payout only, NOT main credits
                await PointTransaction.create({
                    userId: studentId,
                    amount: learnerBonus,
                    type: 'earned',
                    source: 'learner_bonus',
                    description: `Completed "${skillTitle}" swap session`,
                    swapId: swap._id,
                });
            }

            // 2. Process Teacher — earnings go to payout system only, NOT main credits
            if (teacherId) {
                await PointTransaction.create({
                    userId: teacherId,
                    amount: teacherEarned,
                    type: 'earned',
                    source: 'class_taught',
                    description: sessionCredits > 0
                        ? `Taught "${skillTitle}" — 80% of ${sessionCredits} credits`
                        : `Taught "${skillTitle}" (free session bonus)`,
                    swapId: swap._id,
                });
            }
        }

        const reqId = String(swap.requesterId?._id || swap.requesterId || '');
        const recId = String(swap.recipientId?._id || swap.recipientId || '');
        const partnerId = String(userId) === reqId ? recId : (String(userId) === recId ? reqId : recId);

        if (partnerId) {
            emitToUser(partnerId, 'new_notification', {
                category: 'swap',
                title: 'Exchange completed',
                body: `Nice work! Your exchange session is completed. Leave a review!`,
                metadata: {
                    swapId: swap._id.toString(),
                    type: 'swap-action',
                },
            });
        }

        notifySwapUsers(swap);
        res.json(swap);
    } catch (error) {
        console.error('Complete swap error:', error);
        res.status(500).json({ message: 'Failed to complete swap' });
    }
});


// PATCH /api/swaps/:id/decline
router.patch('/:id/decline', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, note } = req.body;

        const swap = await SkillSwap.findById(id);
        if (!swap) {
            return res.status(404).json({ message: 'Swap not found' });
        }

        // update status
        swap.status = 'declined';
        swap.updatedAt = new Date();

        // system message
        swap.negotiationNotes.push({
            authorId: userId,
            body: 'Swap declined.',
            isSystem: true,
            createdAt: new Date(),
        });

        // optional user note
        if (note && note.trim().length > 0) {
            swap.negotiationNotes.push({
                authorId: userId,
                body: note,
                isSystem: false,
                createdAt: new Date(),
            });
        }

        await swap.save();

        const reqId = String(swap.requesterId?._id || swap.requesterId || '');
        const recId = String(swap.recipientId?._id || swap.recipientId || '');
        const partnerId = reqId === String(userId) ? recId : reqId;
        const author = await User.findById(userId);
        const authorName = author?.name || 'Your partner';

        if (partnerId) {
            emitToUser(partnerId, 'new_notification', {
                category: 'swap',
                title: 'Exchange declined',
                body: `${authorName} declined the skill exchange.`,
                metadata: {
                    swapId: swap._id.toString(),
                    type: 'swap-action',
                },
            });
        }

        notifySwapUsers(swap);
        res.json(swap);
    } catch (error) {
        console.error('Decline swap error:', error);
        res.status(500).json({ message: 'Failed to decline swap' });
    }
});






// GET /api/swaps/:id/100ms-room
router.get('/:id/100ms-room', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, isJoining } = req.query; // Who is starting the call
        const swap = await SkillSwap.findById(id);

        if (!swap) {
            return res.status(404).json({ message: 'Swap not found' });
        }

        let HMS;
        try {
            HMS = require('@100mslive/server-sdk');
        } catch (e) {
            return res.status(500).json({ message: '@100mslive/server-sdk not installed or configured' });
        }

        const hms = new HMS.SDK(process.env.HMS_ACCESS_KEY, process.env.HMS_SECRET);

        // Create room if it doesn't exist (using 1:1 swap template)
        if (!swap.hmsRoomId) {
            const room = await hms.rooms.create({
                name: `swap-${id}-${Date.now()}`,
                template_id: process.env.HMS_SWAP_TEMPLATE_ID || process.env.HMS_TEMPLATE_ID,
            });
            swap.hmsRoomId = room.id;
            await swap.save();
        }

        // Send push notification to the partner if userId is provided and they are NOT just joining
        if (userId && isJoining !== 'true') {
            const partnerId = swap.requesterId.toString() === userId.toString() ? swap.recipientId : swap.requesterId;
            const caller = await User.findById(userId);
            const partner = await User.findById(partnerId);

            if (caller && partner) {
                // Send real-time socket call alert to partner
                emitToUser(partnerId.toString(), 'incoming_call', {
                    swapId: swap._id.toString(),
                    callerId: caller._id.toString(),
                    callerName: caller.name,
                    callerAvatar: caller.avatarUrl || caller.avatar,
                    title: 'Incoming Video Call',
                    body: `${caller.name} started the video call. Tap to join!`,
                    mode: 'video',
                });

                if (partner.pushToken) {
                    const { Expo } = require('expo-server-sdk');
                    let expo = new Expo();
                    if (Expo.isExpoPushToken(partner.pushToken)) {
                        let messages = [{
                            to: partner.pushToken,
                            sound: 'default',
                            title: 'Incoming Video Call',
                            body: `${caller.name} is calling you for your skill swap!`,
                            data: { swapId: swap._id, type: 'video-call' },
                        }];
                        try {
                            await expo.sendPushNotificationsAsync(messages);
                            console.log(`Sent incoming call push notification to ${partner.name}`);
                        } catch (pushErr) {
                            console.error('Error sending push notification:', pushErr);
                        }
                    }
                }
            }
        }

        // Get room codes safely (fetch existing first, create if missing)
        let roomCodes = [];
        try {
            for await (const c of hms.roomCodes.list(swap.hmsRoomId)) {
                roomCodes.push(c);
            }
        } catch (e) {
            // Ignore error
        }

        if (!roomCodes || roomCodes.length === 0) {
            try {
                const newCodes = await hms.roomCodes.create(swap.hmsRoomId);
                if (Array.isArray(newCodes)) {
                    roomCodes = newCodes;
                }
            } catch (e) {
                console.error('[SkillSwap 100ms roomCodes.create error]', e);
            }
        }

        console.log('Room codes generated/retrieved:', JSON.stringify(roomCodes));

        // Find host/guest codes based on caller vs joiner
        const isHost = isJoining !== 'true';
        const hostCode = roomCodes.find(c => c.role === 'host')?.code || roomCodes[0]?.code;
        const guestCode = roomCodes.find(c => c.role === 'guest' || c.role === 'joiner' || c.role === 'student')?.code || (roomCodes.length > 1 ? roomCodes[1]?.code : roomCodes[0]?.code);
        const code = isHost ? hostCode : (guestCode || hostCode);
        console.log('Selected swap room code:', code, 'isHost:', isHost);

        res.json({ roomCode: code, roomId: swap.hmsRoomId, isHost });
    } catch (error) {
        console.error('100ms room error:', error);
        res.status(500).json({ message: 'Failed to generate 100ms room' });
    }
});


// router.get('/create', async (req, res) => {
//     let swaps = [
//         {
//             requesterId: currentUser?.id || "",
//             requesterSkillId: currentUser?.skillsOffered[0]?.id ?? '',
//             recipientId: '697b16dbd3bc3938caa71ca4',
//             recipientSkillId: lookupSkillId('2'),
//             status: 'negotiating',
//             locationPreference: 'Metaverse Coffee Bar - Virtual',
//             createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
//             updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
//             proposedTimes: [
//                 {
//                     id: 'slot-initial-1',
//                     proposedById: currentUser?.id || "",
//                     startISO: new Date(tomorrow.getTime()).toISOString(),
//                     endISO: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
//                     status: 'pending',
//                 },
//                 {
//                     id: 'slot-initial-2',
//                     proposedById: '2',
//                     startISO: new Date(twoDays.getTime()).toISOString(),
//                     endISO: new Date(twoDays.getTime() + 60 * 60 * 1000).toISOString(),
//                     status: 'pending',
//                 },
//             ],
//             negotiationNotes: [
//                 {
//                     id: 'msg-initial-1',
//                     authorId: currentUser?.id || "",
//                     body: 'Excited to trade React coaching for your Italian cooking session!',
//                     createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
//                 },
//                 {
//                     id: 'msg-initial-2',
//                     authorId: '2',
//                     body: 'Amazing! Let\'s align on schedule, evenings work best for me.',
//                     createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
//                 },
//             ],
//         },
//         {
//             id: 'swap-initial-2',
//             requesterId: '3',
//             requesterSkillId: lookupSkillId('3'),
//             recipientId: currentUser?.id || "",
//             recipientSkillId: currentUser?.skillsOffered[1]?.id ?? currentUser?.skillsOffered[0]?.id ?? '',
//             status: 'scheduled',
//             locationPreference: 'Downtown Creative Hub',
//             createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
//             updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
//             proposedTimes: [
//                 {
//                     id: 'slot-initial-3',
//                     proposedById: '3',
//                     startISO: new Date(threeDays.getTime()).toISOString(),
//                     endISO: new Date(threeDays.getTime() + 90 * 60 * 1000).toISOString(),
//                     status: 'accepted',
//                 },
//             ],
//             acceptedTimeId: 'slot-initial-3',
//             negotiationNotes: [
//                 {
//                     id: 'msg-initial-3',
//                     authorId: '3',
//                     body: 'Can we exchange Spanish coaching for a photo walk lesson?',
//                     createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
//                 },
//                 {
//                     id: 'msg-initial-4',
//                     authorId: currentUser?.id || "",
//                     body: 'Locked in! Bringing gear for hands-on shooting.',
//                     createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
//                 },
//                 {
//                     id: 'msg-initial-5',
//                     authorId: currentUser?.id || "",
//                     body: 'Swap confirmed for this weekend. See you soon!',
//                     createdAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
//                     isSystem: true,
//                 },
//             ],
//         }
//     ]
// })

module.exports = router;
