const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Skill = require('../../models/Skill');
const GroupClass = require('../../models/GroupClass');
const { CATEGORY_STRUCTURE, MAIN_CATEGORIES } = require('../../constants/categories');
let User = require('../../models/User');
let mongoose = require('mongoose');
const router = express.Router();

const { broadcastEvent } = require('../../socket');

// Multer storage for skill certificates
const certStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './assets/uploads/certificates';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = file.originalname ? path.extname(file.originalname) : '.jpg';
        cb(null, 'cert-' + uniqueSuffix + (ext || '.jpg'));
    },
});

const uploadCertificate = multer({
    storage: certStorage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

/**
 * POST /api/skills/upload-certificate
 * Upload a certificate image via Multer
 */
router.post('/upload-certificate', uploadCertificate.single('certificate'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No certificate file provided' });
        }
        const relativePath = `/uploads/certificates/${req.file.filename}`;
        res.json({
            message: 'Certificate uploaded successfully',
            certificateUri: relativePath,
            filename: req.file.filename,
        });
    } catch (err) {
        console.error('[Upload Certificate Error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/skills/:id/certificate
 * Upload a certificate file via Multer directly for a skill and update its status
 */
router.post('/:id/certificate', uploadCertificate.single('certificate'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'No certificate file provided' });
        }

        const relativePath = `/uploads/certificates/${req.file.filename}`;
        const skill = await Skill.findById(id);
        if (!skill) {
            return res.status(404).json({ error: 'Skill not found' });
        }

        skill.certificateUri = relativePath;
        skill.certificateStatus = 'pending';
        const savedSkill = await skill.save();

        broadcastEvent('certification_submitted', {
            skillId: savedSkill._id.toString(),
            userId: savedSkill.userId.toString(),
            title: savedSkill.title,
            certificateUri: relativePath,
            certificateStatus: 'pending',
            createdAt: savedSkill.createdAt || new Date().toISOString(),
        });

        res.json({
            message: 'Certificate uploaded and attached successfully',
            certificateUri: relativePath,
            skill: savedSkill,
        });
    } catch (err) {
        console.error('[Skill Certificate Upload Error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/skills/:id/certificate/approve
 * Approve a skill certificate
 */
router.patch('/:id/certificate/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid skill ID' });
        }

        const skill = await Skill.findByIdAndUpdate(
            id,
            {
                certificateStatus: 'approved',
                certificateReviewedAt: new Date(),
                certificateReviewNote: note || 'Certificate approved by Admin',
            },
            { new: true }
        );

        if (!skill) {
            return res.status(404).json({ message: 'Skill not found' });
        }

        broadcastEvent('certification_updated', {
            skillId: skill._id.toString(),
            userId: skill.userId.toString(),
            title: skill.title,
            certificateUri: skill.certificateUri,
            certificateStatus: 'approved',
            certificateReviewedAt: skill.certificateReviewedAt,
            certificateReviewNote: skill.certificateReviewNote,
        });

        res.json({
            message: 'Certification approved successfully',
            skill,
        });
    } catch (err) {
        console.error('[Approve Certification Error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/skills/:id/certificate/reject
 * Reject a skill certificate with reason
 */
router.patch('/:id/certificate/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid skill ID' });
        }

        const skill = await Skill.findByIdAndUpdate(
            id,
            {
                certificateStatus: 'rejected',
                certificateReviewedAt: new Date(),
                certificateReviewNote: reason || 'Document rejected by Admin',
            },
            { new: true }
        );

        if (!skill) {
            return res.status(404).json({ message: 'Skill not found' });
        }

        broadcastEvent('certification_updated', {
            skillId: skill._id.toString(),
            userId: skill.userId.toString(),
            title: skill.title,
            certificateUri: skill.certificateUri,
            certificateStatus: 'rejected',
            certificateReviewedAt: skill.certificateReviewedAt,
            certificateReviewNote: skill.certificateReviewNote,
        });

        res.json({
            message: 'Certification rejected successfully',
            skill,
        });
    } catch (err) {
        console.error('[Reject Certification Error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/skills/categories
 * Returns array of dynamic categories from DB & defaults (20 main categories)
 */
router.get('/categories', async (req, res) => {
    try {
        const defaultCategories = MAIN_CATEGORIES;
        const dbCategories = await Skill.distinct('category');
        const dbClassCategories = await GroupClass.distinct('category');
        const allCategories = Array.from(new Set([...defaultCategories, ...dbCategories, ...dbClassCategories])).filter(Boolean);
        res.json(allCategories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/skills/categories/structure
 * Returns full category and subcategory structure
 */
router.get('/categories/structure', async (req, res) => {
    try {
        res.json(CATEGORY_STRUCTURE);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/skills
 * returns Skill[]
 */
router.get('/', async (req, res) => {
    try {
        const skills = await Skill.find();

        const response = skills.map(skill => ({
            id: skill._id,
            title: skill.title,
            category: skill.category,
            subCategory: skill.subCategory || '',
            description: skill.description,
            level: skill.level,
            imageUrl: skill.imageUrl,
            userId: skill.userId,
            pricingModel: skill.pricingModel,
            pricePerSession: skill.pricePerSession,
            monthlyPrice: skill.monthlyPrice,
            promoted: skill.promoted,
            promoTagline: skill.promoTagline,
            certificateUri: skill.certificateUri,
            certificateStatus: skill.certificateStatus,
            certificateReviewNote: skill.certificateReviewNote,
            certificateReviewedAt: skill.certificateReviewedAt,
            reviewNote: skill.certificateReviewNote,
            reviewedAt: skill.certificateReviewedAt,
        }));
        res.json(response);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


/*
  POST /api/skills
  Create a new skill and attach to user
*/
router.post('/', async (req, res) => {
    try {
        const {
            title,
            category,
            subCategory,
            description,
            level,
            userId,
            imageUrl,
            pricingModel,
            pricePerSession,
            monthlyPrice,
            promoted,
            promoTagline,
            certificateUri,
            certificateStatus,
        } = req.body;

        // 🔎 Validation
        if (!title || !category || !level || !userId) {
            return res.status(400).json({
                message: 'Title, category, level and userId are required',
            });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid userId' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 🧠 Create Skill
        const skill = new Skill({
            title,
            category,
            subCategory: subCategory || '',
            description,
            level,
            userId,
            imageUrl,
            pricingModel,
            pricePerSession,
            monthlyPrice,
            promoted,
            promoTagline,
            certificateUri,
            certificateStatus: certificateStatus || (certificateUri ? 'pending' : undefined),
        });

        const savedSkill = await skill.save();

        if (savedSkill.certificateUri) {
            broadcastEvent('certification_submitted', {
                skillId: savedSkill._id.toString(),
                userId: savedSkill.userId.toString(),
                title: savedSkill.title,
                certificateUri: savedSkill.certificateUri,
                certificateStatus: savedSkill.certificateStatus || 'pending',
                createdAt: savedSkill.createdAt || new Date().toISOString(),
            });
        }

        // 🔗 Attach skill to user
        user.skillsOffered.push(savedSkill._id);
        await user.save();

        // 📦 Return populated user
        const populatedUser = await User.findById(userId)
            .populate('skillsOffered');

        res.status(201).json({
            message: 'Skill created successfully',
            skill: {
                id: savedSkill._id.toString(),
                _id: savedSkill._id.toString(),
                title: savedSkill.title,
                category: savedSkill.category,
                subCategory: savedSkill.subCategory || '',
                description: savedSkill.description,
                level: savedSkill.level,
                userId: savedSkill.userId.toString(),
                imageUrl: savedSkill.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
                pricingModel: savedSkill.pricingModel,
                pricePerSession: savedSkill.pricePerSession,
                monthlyPrice: savedSkill.monthlyPrice,
                promoted: savedSkill.promoted,
                promoTagline: savedSkill.promoTagline,
                certificateUri: savedSkill.certificateUri,
                certificateStatus: savedSkill.certificateStatus,
            },
            user: populatedUser,
        });

    } catch (error) {
        console.error('[Create Skill Error]', error);
        res.status(500).json({
            message: 'Server error creating skill',
        });
    }
});

/**
 * PUT /api/skills/:id
 * Update an existing skill
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            category,
            subCategory,
            description,
            level,
            imageUrl,
            pricingModel,
            pricePerSession,
            monthlyPrice,
            promoted,
            promoTagline,
            certificateUri,
            certificateStatus,
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ message: 'Skill not found' });
        }

        const skill = await Skill.findById(id);
        if (!skill) {
            return res.status(404).json({ message: 'Skill not found' });
        }

        if (title !== undefined) skill.title = title;
        if (category !== undefined) skill.category = category;
        if (subCategory !== undefined) skill.subCategory = subCategory;
        if (description !== undefined) skill.description = description;
        if (level !== undefined) skill.level = level;
        if (imageUrl !== undefined) skill.imageUrl = imageUrl;
        if (pricingModel !== undefined) skill.pricingModel = pricingModel;
        if (pricePerSession !== undefined) skill.pricePerSession = pricePerSession;
        if (monthlyPrice !== undefined) skill.monthlyPrice = monthlyPrice;
        if (promoted !== undefined) skill.promoted = promoted;
        if (promoTagline !== undefined) skill.promoTagline = promoTagline;
        if (certificateUri !== undefined) {
            skill.certificateUri = certificateUri;
            if (certificateStatus !== undefined) {
                skill.certificateStatus = certificateStatus;
            } else if (certificateUri) {
                skill.certificateStatus = 'pending';
            }
        } else if (certificateStatus !== undefined) {
            skill.certificateStatus = certificateStatus;
        }

        const updatedSkill = await skill.save();

        if (certificateUri !== undefined || certificateStatus !== undefined) {
            broadcastEvent('certification_updated', {
                skillId: updatedSkill._id.toString(),
                userId: updatedSkill.userId.toString(),
                title: updatedSkill.title,
                certificateUri: updatedSkill.certificateUri,
                certificateStatus: updatedSkill.certificateStatus,
            });
        }

        res.json({
            message: 'Skill updated successfully',
            skill: {
                id: updatedSkill._id.toString(),
                _id: updatedSkill._id.toString(),
                title: updatedSkill.title,
                category: updatedSkill.category,
                subCategory: updatedSkill.subCategory || '',
                description: updatedSkill.description,
                level: updatedSkill.level,
                userId: updatedSkill.userId.toString(),
                imageUrl: updatedSkill.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
                pricingModel: updatedSkill.pricingModel,
                pricePerSession: updatedSkill.pricePerSession,
                monthlyPrice: updatedSkill.monthlyPrice,
                promoted: updatedSkill.promoted,
                promoTagline: updatedSkill.promoTagline,
                certificateUri: updatedSkill.certificateUri,
                certificateStatus: updatedSkill.certificateStatus,
            },
        });
    } catch (err) {
        console.error('[Update Skill Error]', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/skills/:id
 * Delete a skill and remove reference from user
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const skill = await Skill.findByIdAndDelete(id);
        if (skill && skill.userId) {
            await User.findByIdAndUpdate(skill.userId, {
                $pull: { skillsOffered: id },
            });
        }
        res.json({ message: 'Skill deleted successfully', id });
    } catch (err) {
        console.error('[Delete Skill Error]', err);
        res.status(500).json({ error: err.message });
    }
});


let skillsWithUsersCache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 10000; // 10 seconds cache

/**
 * Invalidate skills cache on mutations
 */
const invalidateSkillsCache = () => {
    skillsWithUsersCache = { data: null, timestamp: 0 };
};

/**
 * GET /api/skills/with-users
 * returns SkillWithUser[] with real ratings and exchanges from database (cached & parallelized)
 */
router.get('/with-users', async (req, res) => {
    try {
        const now = Date.now();
        if (skillsWithUsersCache.data && (now - skillsWithUsersCache.timestamp < CACHE_TTL_MS)) {
            return res.json(skillsWithUsersCache.data);
        }

        const Review = require('../../models/Review');
        const SkillSwap = require('../../models/SkillSwap');

        // Execute all 3 queries in parallel using lean() for maximum speed
        const [skills, reviewAgg, completedSwaps] = await Promise.all([
            Skill.find().populate('userId').lean(),
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

        const response = [];

        skills.forEach(skill => {
            if (skill.userId) {
                const uid = skill.userId._id.toString();
                const realRev = reviewMap.get(uid);
                const realSwaps = swapMap.get(uid);

                const dynamicRating = realRev ? realRev.avgRating : (skill.userId.rating ?? 5.0);
                const dynamicSwaps = realSwaps !== undefined ? Math.max(realSwaps, skill.userId.totalSwaps ?? 0) : (skill.userId.totalSwaps ?? 0);

                const data = {
                    id: skill._id,
                    title: skill.title,
                    category: skill.category,
                    subCategory: skill.subCategory || '',
                    description: skill.description,
                    level: skill.level,
                    imageUrl: skill.imageUrl,
                    userId: skill.userId._id,
                    pricingModel: skill.pricingModel,
                    pricePerSession: skill.pricePerSession,
                    monthlyPrice: skill.monthlyPrice,
                    promoted: skill.promoted,
                    promoTagline: skill.promoTagline,
                    certificateUri: skill.certificateUri,
                    certificateStatus: skill.certificateStatus,
                    certificateReviewNote: skill.certificateReviewNote,
                    certificateReviewedAt: skill.certificateReviewedAt,
                    reviewNote: skill.certificateReviewNote,
                    reviewedAt: skill.certificateReviewedAt,
                    user: {
                        id: skill.userId._id,
                        name: skill.userId.name,
                        username: skill.userId.username,
                        avatarUrl: skill.userId.avatarUrl,
                        bio: skill.userId.bio,
                        location: skill.userId.location,
                        skillsOffered: [],
                        skillsWanted: skill.userId.skillsWanted,
                        rating: dynamicRating,
                        reviewCount: realRev ? realRev.count : 0,
                        totalSwaps: dynamicSwaps,
                        joinedDate: skill.userId.joinedDate,
                        credits: skill.userId.credits,
                        premiumTier: skill.userId.premiumTier,
                        premiumExpiresAt: skill.userId.premiumExpiresAt
                    }
                };
                response.push(data);
            }
        });

        skillsWithUsersCache = { data: response, timestamp: Date.now() };
        res.json(response);
    } catch (err) {
        console.error('[GET /skills/with-users error]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
