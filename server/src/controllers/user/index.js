const express = require('express');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Skill = require('../../models/Skill');
const {
    MAIN_CATEGORIES,
    findCategoryForSubcategory,
    getCategoryImageUrl,
} = require('../../constants/categories');
const { emitToUser, broadcastEvent } = require('../../socket');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './assets/uploads/avatars');
    },
    filename: function (req, file, cb) {
        const uniqueName =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueName + path.extname(file.originalname));
    },
});

const fileFilter = (req, file, cb) => {
    // if (file.mimetype.startsWith('image/')) {
    //     cb(null, true);
    // } else {
    //     cb(new Error('Only image files allowed'), false);
    // }

    cb(null, true);

};

const uploadAvatar = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});



let usersCache = { data: null, timestamp: 0 };
const USERS_CACHE_TTL_MS = 10000;

/**
 * GET /api/users
 */
router.get('/', async (req, res) => {
    try {
        const now = Date.now();
        if (usersCache.data && (now - usersCache.timestamp < USERS_CACHE_TTL_MS)) {
            return res.json(usersCache.data);
        }

        const Review = require('../../models/Review');
        const SkillSwap = require('../../models/SkillSwap');

        // Parallelize database lookups using lean()
        const [users, reviewAgg, completedSwaps] = await Promise.all([
            User.find().populate('skillsOffered').lean(),
            Review.aggregate([
                { $match: { moderationStatus: { $ne: 'rejected' } } },
                {
                    $group: {
                        _id: '$revieweeId',
                        avgRating: { $avg: '$rating' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            SkillSwap.find({ status: 'completed' }).select('requesterId recipientId').lean()
        ]);

        // Build review map
        const reviewMap = new Map();
        reviewAgg.forEach(r => {
            if (r._id) {
                reviewMap.set(r._id.toString(), {
                    avgRating: Math.round(r.avgRating * 10) / 10,
                    count: r.count
                });
            }
        });

        // Build completed swaps map
        const swapMap = new Map();
        completedSwaps.forEach(sw => {
            const reqId = sw.requesterId ? sw.requesterId.toString() : null;
            const recId = sw.recipientId ? sw.recipientId.toString() : null;
            if (reqId) swapMap.set(reqId, (swapMap.get(reqId) || 0) + 1);
            if (recId) swapMap.set(recId, (swapMap.get(recId) || 0) + 1);
        });

        const mappedUsers = users.map(user => {
            const uid = user._id.toString();
            const realRev = reviewMap.get(uid);
            const realSwaps = swapMap.get(uid);

            const dynamicRating = realRev ? realRev.avgRating : (user.rating ?? 5.0);
            const dynamicSwaps = realSwaps !== undefined ? Math.max(realSwaps, user.totalSwaps ?? 0) : (user.totalSwaps ?? 0);

            return {
                id: user._id,
                _id: user._id,
                name: user.name,
                username: user.username,
                avatarUrl: user.avatarUrl,
                bio: user.bio,
                location: user.location,
                skillsOffered: user.skillsOffered,
                skillsWanted: user.skillsWanted,
                rating: dynamicRating,
                reviewCount: realRev ? realRev.count : 0,
                totalSwaps: dynamicSwaps,
                joinedDate: user.joinedDate,
                credits: user.credits,
                premiumTier: user.premiumTier,
                premiumExpiresAt: user.premiumExpiresAt,
                email: user.email,
                phone: user.phone,
                isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified,
                banStatus: user.banStatus,
                reportCount: user.reportCount,
                teacherProfile: user.teacherProfile,
            };
        });

        usersCache = { data: mappedUsers, timestamp: Date.now() };
        res.json(mappedUsers);
    } catch (err) {
        console.error('[GET /users error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /users/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'User id is required' });
        }

        let user;
        if (mongoose.Types.ObjectId.isValid(id)) {
            user = await User.findById(id).populate('skillsOffered');
        } else {
            user = await User.findOne({ username: id.toLowerCase().replace('@', '') }).populate('skillsOffered');
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const Review = require('../../models/Review');
        const SkillSwap = require('../../models/SkillSwap');
        const uid = user._id.toString();

        let dynamicRating = user.rating ?? 5.0;
        let reviewCount = 0;
        try {
            const reviewAgg = await Review.aggregate([
                { $match: { revieweeId: user._id, moderationStatus: { $ne: 'rejected' } } },
                {
                    $group: {
                        _id: '$revieweeId',
                        avgRating: { $avg: '$rating' },
                        count: { $sum: 1 }
                    }
                }
            ]);
            if (reviewAgg && reviewAgg.length > 0) {
                dynamicRating = Math.round(reviewAgg[0].avgRating * 10) / 10;
                reviewCount = reviewAgg[0].count;
            }
        } catch (e) {}

        let dynamicSwaps = user.totalSwaps ?? 0;
        try {
            const completedCount = await SkillSwap.countDocuments({
                $or: [{ requesterId: user._id }, { recipientId: user._id }],
                status: 'completed'
            });
            dynamicSwaps = Math.max(completedCount, user.totalSwaps ?? 0);
        } catch (e) {}

        res.json({
            id: user._id,
            _id: user._id,
            name: user.name,
            username: user.username,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            location: user.location,
            skillsOffered: user.skillsOffered,
            skillsWanted: user.skillsWanted,
            rating: dynamicRating,
            reviewCount,
            totalSwaps: dynamicSwaps,
            joinedDate: user.joinedDate,
            credits: user.credits,
            premiumTier: user.premiumTier,
            premiumExpiresAt: user.premiumExpiresAt,
            email: user.email,
            phone: user.phone,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            banStatus: user.banStatus,
            reportCount: user.reportCount,
            teacherProfile: user.teacherProfile,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});





/**
 * PUT /users/me
 * Update current user's profile
 */
// router.put('/me', async (req, res) => {
//     try {
//         const userId = req.body.userId;

//         const {
//             name,
//             bio,
//             location,
//             skillsWanted,
//             avatarUrl,
//         } = req.body;

//         // Only allow editable fields
//         const updateData = {
//             name,
//             bio,
//             location,
//             skillsWanted,
//             avatarUrl,
//         };

//         const updatedUser = await User.findByIdAndUpdate(
//             userId,
//             { $set: updateData },
//             { new: true, runValidators: true }
//         );

//         if (!updatedUser) {
//             return res.status(404).json({ message: 'User not found' });
//         }

//         res.json({
//             success: true,
//             user: updatedUser,
//         });
//     } catch (error) {
//         console.error('[Update Profile]', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// });

/**
 * PUT /users/me
 * Update profile + avatar
 */
router.put(
    '/me',
    uploadAvatar.single('avatar'),
    async (req, res) => {
        try {
            const userId = req.body.userId || req.user?.id || req.user?._id;
            if (!userId) {
                return res.status(400).json({ message: 'User ID is required' });
            }

            const {
                name,
                bio,
                location,
                skillsWanted,
                skillsOffered,
                teacherProfile,
            } = req.body;

            const updateData = {};
            if (name !== undefined) updateData.name = String(name).trim();
            if (bio !== undefined) updateData.bio = String(bio).trim();
            if (location !== undefined) updateData.location = String(location).trim();

            if (teacherProfile !== undefined) {
                let parsedTeacher = null;
                if (typeof teacherProfile === 'string') {
                    try {
                        parsedTeacher = JSON.parse(teacherProfile);
                    } catch (e) {
                        parsedTeacher = null;
                    }
                } else if (typeof teacherProfile === 'object' && teacherProfile !== null) {
                    parsedTeacher = teacherProfile;
                }
                if (parsedTeacher) {
                    const cleanTeacher = {};
                    cleanTeacher.languages = Array.isArray(parsedTeacher.languages)
                        ? parsedTeacher.languages.map(l => String(l).trim()).filter(Boolean)
                        : [];
                    cleanTeacher.qualifications = Array.isArray(parsedTeacher.qualifications)
                        ? parsedTeacher.qualifications.map(q => String(q).trim()).filter(Boolean)
                        : [];
                    cleanTeacher.isCertified = Boolean(parsedTeacher.isCertified);
                    cleanTeacher.privateTuition = Boolean(parsedTeacher.privateTuition);
                    cleanTeacher.yearsTeaching = String(parsedTeacher.yearsTeaching || '').trim();
                    cleanTeacher.certifications = Array.isArray(parsedTeacher.certifications)
                        ? parsedTeacher.certifications
                            .filter(c => c && typeof c.title === 'string' && c.title.trim().length > 0)
                            .map(c => ({
                                id: c.id || c._id || `cert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                title: c.title.trim(),
                                documentUri: c.documentUri || '',
                                status: ['pending', 'approved', 'rejected'].includes(c.status) ? c.status : 'pending',
                                reviewNote: c.reviewNote || '',
                                reviewedAt: c.reviewedAt || null,
                            }))
                        : [];
                    cleanTeacher.careerHistory = Array.isArray(parsedTeacher.careerHistory)
                        ? parsedTeacher.careerHistory
                            .filter(ch => ch && typeof ch.role === 'string' && ch.role.trim().length > 0)
                            .map(ch => ({
                                id: ch.id || ch._id || `career-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                role: ch.role.trim(),
                                organization: String(ch.organization || '').trim(),
                                years: String(ch.years || '').trim(),
                            }))
                        : [];

                    updateData.teacherProfile = cleanTeacher;
                }
            }

            if (skillsWanted !== undefined) {
                let parsed = [];
                if (typeof skillsWanted === 'string') {
                    try {
                        parsed = JSON.parse(skillsWanted);
                    } catch (e) {
                        parsed = skillsWanted ? [skillsWanted] : [];
                    }
                } else if (Array.isArray(skillsWanted)) {
                    parsed = skillsWanted;
                }
                updateData.skillsWanted = Array.isArray(parsed)
                    ? parsed.map((s) => String(s).trim()).filter(Boolean)
                    : [];
            }

            // Update per-skill pricing / promotion if skillsOffered array sent
            if (skillsOffered !== undefined) {
                let parsedSkills = [];
                if (typeof skillsOffered === 'string') {
                    try {
                        parsedSkills = JSON.parse(skillsOffered);
                    } catch (e) {
                        parsedSkills = [];
                    }
                } else if (Array.isArray(skillsOffered)) {
                    parsedSkills = skillsOffered;
                }

                const Skill = require('../../models/Skill');
                for (const s of parsedSkills) {
                    const skillId = s.id || s._id;
                    if (skillId && mongoose.Types.ObjectId.isValid(skillId)) {
                        const skillUpdate = {};
                        if (s.pricingModel !== undefined) skillUpdate.pricingModel = s.pricingModel;
                        if (s.pricePerSession !== undefined) skillUpdate.pricePerSession = Number(s.pricePerSession) || 0;
                        if (s.monthlyPrice !== undefined) skillUpdate.monthlyPrice = Number(s.monthlyPrice) || 0;
                        if (s.promoted !== undefined) skillUpdate.promoted = Boolean(s.promoted);
                        if (s.promoTagline !== undefined) skillUpdate.promoTagline = String(s.promoTagline || '').trim();

                        await Skill.findByIdAndUpdate(skillId, { $set: skillUpdate });
                    }
                }
            }

            // If avatar uploaded
            if (req.file) {
                console.log(`/uploads/avatars/${req.file.filename}`);
                updateData.avatarUrl = `/uploads/avatars/${req.file.filename}`;
            }

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { $set: updateData },
                { new: true, runValidators: true }
            ).populate('skillsOffered');

            if (!updatedUser) {
                return res.status(404).json({ message: 'User not found' });
            }

            broadcastEvent('user_updated', {
                userId: updatedUser._id.toString(),
                user: updatedUser,
            });

            res.json({
                success: true,
                user: updatedUser,
            });
        } catch (error) {
            console.error('[Update Profile]', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

const creditPackages = {
    starter:  { name: 'Starter',  credits: 99,   bonusCredits: 0,   price: 99 },
    basic:    { name: 'Basic',    credits: 249,  bonusCredits: 15,  price: 249 },
    popular:  { name: 'Popular',  credits: 499,  bonusCredits: 40,  price: 499 },
    pro:      { name: 'Pro',      credits: 999,  bonusCredits: 100, price: 999 },
    premium:  { name: 'Premium',  credits: 1999, bonusCredits: 250, price: 1999 },
    ultimate: { name: 'Ultimate', credits: 4999, bonusCredits: 750, price: 4999 },
};

const premiumBenefits = {
    monthly:   { monthlyCredits: 50,  durationDays: 30,  name: 'Monthly' },
    quarterly: { monthlyCredits: 200, durationDays: 90,  name: 'Quarterly' },
    yearly:    { monthlyCredits: 750, durationDays: 365, name: 'Yearly' },
    basic:     { monthlyCredits: 50,  durationDays: 30,  name: 'Monthly' },
    premium:   { monthlyCredits: 200, durationDays: 90,  name: 'Quarterly' },
    elite:     { monthlyCredits: 750, durationDays: 365, name: 'Yearly' },
};

router.post('/credits/purchase', async (req, res) => {
    try {
        const { userId, packageId } = req.body;
        if (!userId || !packageId) {
            return res.status(400).json({ message: 'Missing userId or packageId' });
        }
        const pkg = creditPackages[packageId];
        if (!pkg) {
            return res.status(400).json({ message: 'Invalid packageId' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const creditsToAdd = pkg.credits + (pkg.bonusCredits || 0);
        user.credits = (user.credits || 0) + creditsToAdd;
        await user.save();

        // Record credit transaction in database
        const PointTransaction = require('../../models/PointTransaction');
        await PointTransaction.create({
            userId: user._id,
            amount: creditsToAdd,
            type: 'earned',
            source: 'top_up',
            description: `Top-up: Purchased ${pkg.credits} credits${pkg.bonusCredits > 0 ? ` + ${pkg.bonusCredits} bonus` : ''}`,
        });

        // Broadcast socket updates
        try {
            const { emitToUser, broadcastEvent } = require('../../socket');
            emitToUser(user._id.toString(), 'credits_updated', { userId: user._id, credits: user.credits, newBalance: user.credits });
            emitToUser(user._id.toString(), 'user_updated', user);
            broadcastEvent('user_updated', { userId: user._id, credits: user.credits });
        } catch (socketErr) {
            console.warn('[Socket Broadcast Warning]', socketErr.message);
        }

        res.json({
            success: true,
            newBalance: user.credits,
            creditsAdded: creditsToAdd,
            user,
        });
    } catch (err) {
        console.error('[Purchase Credits Error]', err);
        res.status(500).json({ message: 'Purchase failed', error: err.message });
    }
});

router.post('/premium/purchase', async (req, res) => {
    try {
        const { userId, tier, duration } = req.body;
        if (!userId || !tier) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const benefits = premiumBenefits[tier] || premiumBenefits.monthly;
        if (!benefits) {
            return res.status(400).json({ message: 'Invalid tier' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const now = Date.now();
        const days = benefits.durationDays || (tier === 'yearly' || duration === 'yearly' ? 365 : (tier === 'quarterly' ? 90 : 30));
        const durationMs = days * 24 * 60 * 60 * 1000;
        
        // Extend existing subscription if active, otherwise start from now
        const currentExpiry = (user.premiumExpiresAt && new Date(user.premiumExpiresAt).getTime() > now)
            ? new Date(user.premiumExpiresAt).getTime()
            : now;
        const expiresAt = currentExpiry + durationMs;

        // Normalize tier (monthly -> basic, quarterly -> premium, yearly -> elite)
        const normalizedTier = (tier === 'yearly' || tier === 'elite')
            ? 'elite'
            : (tier === 'quarterly' || tier === 'premium')
                ? 'premium'
                : 'basic';

        user.premiumTier = normalizedTier;
        user.premiumExpiresAt = new Date(expiresAt);
        const bonusCreditsToAdd = benefits.monthlyCredits || 50;
        user.credits = (user.credits || 0) + bonusCreditsToAdd;
        await user.save();

        // Record PointTransaction in database
        const PointTransaction = require('../../models/PointTransaction');
        await PointTransaction.create({
            userId: user._id,
            amount: bonusCreditsToAdd,
            type: 'earned',
            source: 'monthly_subscription',
            description: `Trial/Demo Subscription: ${benefits.name} Plan (+${bonusCreditsToAdd} bonus credits)`,
        });

        // Broadcast socket updates
        try {
            const { emitToUser, broadcastEvent } = require('../../socket');
            emitToUser(user._id.toString(), 'credits_updated', { userId: user._id, credits: user.credits, newBalance: user.credits });
            emitToUser(user._id.toString(), 'user_updated', user);
            broadcastEvent('user_updated', { userId: user._id, premiumTier: user.premiumTier, premiumExpiresAt: user.premiumExpiresAt });
        } catch (socketErr) {
            console.warn('[Socket Broadcast Warning]', socketErr.message);
        }

        res.json({
            success: true,
            tier: user.premiumTier,
            expiresAt: user.premiumExpiresAt.toISOString(),
            creditsAdded: bonusCreditsToAdd,
            newBalance: user.credits,
            user,
        });
    } catch (err) {
        console.error('[Purchase Premium Error]', err);
        res.status(500).json({ message: 'Purchase failed', error: err.message });
    }
});

router.post('/push-token', async (req, res) => {
    try {
        const { userId, token } = req.body;
        if (!userId || !token) {
            return res.status(400).json({ message: 'Missing userId or token' });
        }
        const user = await User.findByIdAndUpdate(userId, { pushToken: token }, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ success: true, user });
    } catch (err) {
        console.error('[Register Push Token Error]', err);
        res.status(500).json({ message: 'Failed to register push token' });
    }
});

router.post('/onboarding', async (req, res) => {
    try {
        const {
            userId,
            skillsToTeach,
            skillsToLearn,
            experienceLevels,
            teachSkillDetails,
            teacherProfile,
            matchingPreferences,
        } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'Missing userId' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (Array.isArray(skillsToLearn)) {
            user.skillsWanted = skillsToLearn;
        }

        if (teacherProfile && typeof teacherProfile === 'object') {
            // Ensure certificates have pending status and broadcast to admin
            if (Array.isArray(teacherProfile.certifications)) {
                teacherProfile.certifications = teacherProfile.certifications.map(c => ({
                    ...c,
                    status: c.status || 'pending',
                }));
            }
            user.teacherProfile = teacherProfile;
        }

        if (matchingPreferences && matchingPreferences.location) {
            user.location = matchingPreferences.location;
        }

        if (Array.isArray(skillsToTeach)) {
            await Skill.deleteMany({ userId: user._id });
            user.skillsOffered = [];

            for (const skill of skillsToTeach) {
                const skillTitle = typeof skill === 'string' ? skill : (skill.title || skill.name);
                const detail = (teachSkillDetails && teachSkillDetails[skillTitle]) || (typeof skill === 'object' ? skill : {});

                const mainCategory = detail.category || findCategoryForSubcategory(skillTitle) || (MAIN_CATEGORIES.includes(skillTitle) ? skillTitle : 'Other / Miscellaneous');
                const catImg = getCategoryImageUrl(mainCategory);

                // Check if any uploaded certification matches this skill
                let matchingCert = null;
                if (teacherProfile && Array.isArray(teacherProfile.certifications)) {
                    matchingCert = teacherProfile.certifications.find(
                        c => c.documentUri && (
                            c.title.toLowerCase().includes(skillTitle.toLowerCase()) ||
                            skillTitle.toLowerCase().includes(c.title.toLowerCase()) ||
                            teacherProfile.certifications.length === 1
                        )
                    );
                }

                const newSkill = new Skill({
                    title: skillTitle,
                    category: mainCategory,
                    subCategory: detail.subCategory || skillTitle,
                    description: detail.description?.trim() || `I can teach and share knowledge in ${skillTitle}.`,
                    level: detail.level || (experienceLevels && experienceLevels[skillTitle]) || 'Intermediate',
                    pricingModel: detail.pricingModel || 'free',
                    pricePerSession: detail.pricingModel === 'per_session' ? Number(detail.pricePerSession || 50) : undefined,
                    monthlyPrice: detail.pricingModel === 'monthly' ? Number(detail.monthlyPrice || 200) : undefined,
                    promoted: Boolean(detail.promoted),
                    promoTagline: detail.promoTagline?.trim() || undefined,
                    certificateUri: matchingCert?.documentUri || detail.certificateUri || undefined,
                    certificateStatus: (matchingCert?.documentUri || detail.certificateUri) ? (matchingCert?.status || 'pending') : undefined,
                    userId: user._id,
                    imageUrl: catImg,
                });
                const savedSkill = await newSkill.save();
                user.skillsOffered.push(savedSkill._id);
            }
        }

        user.hasCompletedOnboarding = true;
        await user.save();

        const populatedUser = await User.findById(userId).populate('skillsOffered');

        // 🔔 Notify admin in real-time about submitted certifications
        if (teacherProfile && Array.isArray(teacherProfile.certifications)) {
            for (const cert of teacherProfile.certifications) {
                if (cert.documentUri) {
                    broadcastEvent('certification_submitted', {
                        id: `cr-usr-${user._id}-${cert.id || 'c1'}`,
                        userId: user._id.toString(),
                        userName: user.name,
                        userAvatar: user.avatarUrl,
                        certId: cert.id,
                        skillId: (user.skillsOffered[0] && user.skillsOffered[0]._id ? user.skillsOffered[0]._id.toString() : user.skillsOffered[0]?.toString()) || `cert-${cert.id}`,
                        skillTitle: cert.title,
                        documentUri: cert.documentUri,
                        status: 'pending',
                        submittedAt: new Date().toISOString(),
                    });
                }
            }
        }

        res.json({
            success: true,
            user: populatedUser || user,
        });
    } catch (err) {
        console.error('[Onboarding Error]', err);
        res.status(500).json({ message: 'Onboarding completion failed' });
    }
});

/**
 * PATCH /users/:userId/certifications/:certId/approve
 * Admin approves a user teacherProfile certification
 */
router.patch('/:userId/certifications/:certId/approve', async (req, res) => {
    try {
        const { userId, certId } = req.params;
        const { note } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.teacherProfile && Array.isArray(user.teacherProfile.certifications)) {
            const cert = user.teacherProfile.certifications.find(c => String(c.id) === String(certId) || String(c._id) === String(certId));
            if (cert) {
                cert.status = 'approved';
                cert.reviewNote = note || 'Certificate approved by Admin';
                cert.reviewedAt = new Date();
            }
        }

        // Also approve any matching skill
        await Skill.updateMany(
            { userId: user._id, certificateStatus: 'pending' },
            { certificateStatus: 'approved', certificateReviewNote: note || 'Certificate approved by Admin', certificateReviewedAt: new Date() }
        );

        user.markModified('teacherProfile');
        await user.save();

        broadcastEvent('certification_updated', {
            userId: user._id.toString(),
            certId,
            status: 'approved',
            reviewedAt: new Date().toISOString(),
            reviewNote: note || 'Certificate approved by Admin',
        });

        res.json({ success: true, user });
    } catch (err) {
        console.error('[Approve Certification Error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /users/:userId/certifications/:certId/reject
 * Admin rejects a user teacherProfile certification
 */
router.patch('/:userId/certifications/:certId/reject', async (req, res) => {
    try {
        const { userId, certId } = req.params;
        const { reason } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.teacherProfile && Array.isArray(user.teacherProfile.certifications)) {
            const cert = user.teacherProfile.certifications.find(c => String(c.id) === String(certId) || String(c._id) === String(certId));
            if (cert) {
                cert.status = 'rejected';
                cert.reviewNote = reason || 'Document rejected by Admin';
                cert.reviewedAt = new Date();
            }
        }

        await Skill.updateMany(
            { userId: user._id, certificateStatus: 'pending' },
            { certificateStatus: 'rejected', certificateReviewNote: reason || 'Document rejected by Admin', certificateReviewedAt: new Date() }
        );

        user.markModified('teacherProfile');
        await user.save();

        broadcastEvent('certification_updated', {
            userId: user._id.toString(),
            certId,
            status: 'rejected',
            reviewedAt: new Date().toISOString(),
            reviewNote: reason || 'Document rejected by Admin',
        });

        res.json({ success: true, user });
    } catch (err) {
        console.error('[Reject Certification Error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Helper to check if there is an active block between two users
 */
async function isBlockedBetween(userAId, userBId) {
    if (!userAId || !userBId) return false;
    if (String(userAId) === String(userBId)) return false;

    try {
        const [userA, userB] = await Promise.all([
            User.findById(userAId).select('blockedUsers').lean(),
            User.findById(userBId).select('blockedUsers').lean(),
        ]);

        const aBlockedB = userA?.blockedUsers?.some(
            (b) => String(b.userId || b._id) === String(userBId)
        );
        const bBlockedA = userB?.blockedUsers?.some(
            (b) => String(b.userId || b._id) === String(userAId)
        );

        return Boolean(aBlockedB || bBlockedA);
    } catch (err) {
        console.error('[isBlockedBetween error]', err);
        return false;
    }
}

/**
 * GET /users/:userId/blocked
 * Get list of users blocked by userId
 */
router.get('/:userId/blocked', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Valid userId is required' });
        }

        const user = await User.findById(userId).populate('blockedUsers.userId', 'name username avatarUrl');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const formatted = (user.blockedUsers || []).map((b) => {
            const populatedUser = b.userId && typeof b.userId === 'object' ? b.userId : null;
            const targetId = populatedUser ? populatedUser._id.toString() : String(b.userId || b._id);
            return {
                id: b._id ? b._id.toString() : `blk-${targetId}`,
                blockedUserId: targetId,
                blockedUserName: populatedUser?.name || b.name || 'User',
                blockedUserAvatar: populatedUser?.avatarUrl || b.avatarUrl || '',
                blockedAt: b.blockedAt ? new Date(b.blockedAt).toISOString() : new Date().toISOString(),
            };
        });

        res.json({ success: true, blockedUsers: formatted });
    } catch (err) {
        console.error('[GET /users/:userId/blocked error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /users/:userId/block
 * Block a target user
 */
router.post('/:userId/block', async (req, res) => {
    try {
        const { userId } = req.params;
        const { targetUserId, name, avatarUrl } = req.body;

        if (!userId || !targetUserId) {
            return res.status(400).json({ message: 'userId and targetUserId are required' });
        }

        if (String(userId) === String(targetUserId)) {
            return res.status(400).json({ message: 'Cannot block yourself' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Fetch target user info if not provided
        let targetName = name;
        let targetAvatar = avatarUrl;
        if (!targetName && mongoose.Types.ObjectId.isValid(targetUserId)) {
            const targetUser = await User.findById(targetUserId);
            if (targetUser) {
                targetName = targetUser.name;
                targetAvatar = targetUser.avatarUrl;
            }
        }

        if (!user.blockedUsers) {
            user.blockedUsers = [];
        }

        const alreadyBlocked = user.blockedUsers.some(
            (b) => String(b.userId) === String(targetUserId)
        );

        if (!alreadyBlocked) {
            user.blockedUsers.push({
                userId: targetUserId,
                name: targetName || 'User',
                avatarUrl: targetAvatar || '',
                blockedAt: new Date(),
            });
            await user.save();
        }

        const formatted = user.blockedUsers.map((b) => ({
            id: b._id ? b._id.toString() : `blk-${b.userId}`,
            blockedUserId: String(b.userId),
            blockedUserName: b.name || 'User',
            blockedUserAvatar: b.avatarUrl || '',
            blockedAt: b.blockedAt ? new Date(b.blockedAt).toISOString() : new Date().toISOString(),
        }));

        res.json({ success: true, blockedUsers: formatted });
    } catch (err) {
        console.error('[POST /users/:userId/block error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /users/:userId/unblock
 * Unblock a target user
 */
router.post('/:userId/unblock', async (req, res) => {
    try {
        const { userId } = req.params;
        const { targetUserId } = req.body;

        if (!userId || !targetUserId) {
            return res.status(400).json({ message: 'userId and targetUserId are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.blockedUsers) {
            user.blockedUsers = user.blockedUsers.filter(
                (b) => String(b.userId) !== String(targetUserId) && String(b._id) !== String(targetUserId)
            );
            await user.save();
        }

        const formatted = (user.blockedUsers || []).map((b) => ({
            id: b._id ? b._id.toString() : `blk-${b.userId}`,
            blockedUserId: String(b.userId),
            blockedUserName: b.name || 'User',
            blockedUserAvatar: b.avatarUrl || '',
            blockedAt: b.blockedAt ? new Date(b.blockedAt).toISOString() : new Date().toISOString(),
        }));

        res.json({ success: true, blockedUsers: formatted });
    } catch (err) {
        console.error('[POST /users/:userId/unblock error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /users/:userId/block-status/:targetUserId
 * Check block status between two users
 */
router.get('/:userId/block-status/:targetUserId', async (req, res) => {
    try {
        const { userId, targetUserId } = req.params;
        if (!userId || !targetUserId) {
            return res.status(400).json({ message: 'userId and targetUserId are required' });
        }

        const [userA, userB] = await Promise.all([
            User.findById(userId).select('blockedUsers').lean(),
            User.findById(targetUserId).select('blockedUsers').lean(),
        ]);

        const isBlockedByMe = Boolean(
            userA?.blockedUsers?.some((b) => String(b.userId || b._id) === String(targetUserId))
        );
        const hasBlockedMe = Boolean(
            userB?.blockedUsers?.some((b) => String(b.userId || b._id) === String(userId))
        );

        res.json({
            success: true,
            isBlockedByMe,
            hasBlockedMe,
            isBlocked: isBlockedByMe || hasBlockedMe,
        });
    } catch (err) {
        console.error('[GET block-status error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /users/me
 * Delete user account and associated data (App Store Guideline 5.1.1(v))
 */
router.delete('/me', async (req, res) => {
    try {
        const userId = req.body?.userId || req.query?.userId || req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        await User.findByIdAndDelete(userId);
        await Skill.deleteMany({ userId });

        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (err) {
        console.error('[DELETE /users/me error]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
module.exports.isBlockedBetween = isBlockedBetween;

