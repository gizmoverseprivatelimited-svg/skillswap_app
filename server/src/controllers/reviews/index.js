const express = require('express');
const router = express.Router();
const Review = require('../../models/Review');
const PointTransaction = require('../../models/PointTransaction');
const { emitToUser, broadcastEvent } = require('../../socket');

// POST /api/reviews
router.post('/', async (req, res) => {
  try {
    const {
      reviewerId,
      revieweeId,
      rating,
      comment,
      skillId,
    } = req.body;

    if (!reviewerId || !revieweeId || !rating) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (reviewerId === revieweeId) {
      return res.status(400).json({ message: 'You cannot review yourself' });
    }

    const review = await Review.create({
      reviewerId,
      revieweeId,
      rating,
      comment,
      skillId,
    });

    // 🌟 25 Points Bonus for 5-Star Reviews
    if (Number(rating) === 5) {
      await PointTransaction.create({
        userId: revieweeId,
        amount: 25,
        type: 'earned',
        source: 'bonus',
        description: 'Received a 5-Star Review bonus (+25 pts)',
      });
    }

    // Emit Socket.IO real-time event
    emitToUser(revieweeId, 'review_created', review);
    broadcastEvent('review_created', review);

    res.status(201).json(review);
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Failed to create review' });
  }
});


/**
 * GET /reviews
 */
router.get('/', async (req, res) => {
  const { revieweeId, skillId } = req.query;

  const mongoose = require('mongoose');
  if (!revieweeId || !mongoose.Types.ObjectId.isValid(revieweeId)) {
    return res.json({ reviews: [], stats: { totalReviews: 0, averageRating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } });
  }

  const filter = { revieweeId };
  if (skillId) filter.skillId = skillId;

  const reviews = await Review.find(filter)
    .populate('reviewerId', 'name avatarUrl')
    .sort({ createdAt: -1 });

  // console.log(reviews);

  let data = reviews.map((review) => ({
    id: review._id,
    reviewer: {
      id: review.reviewerId._id,
      name: review.reviewerId.name,
      avatarUrl: review.reviewerId.avatarUrl
    },
    reviewerId: review.reviewerId,
    revieweeId: review.revieweeId,
    rating: review.rating,
    comment: review.comment,
    skillId: review.skillId,
    flagReason: review.flagReason,
    flagReporterId: review.flagReporterId,
    flaggedAt: review.flaggedAt,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  }))

  // console.log(data);



  const stats = {
    totalReviews: reviews.length,
    averageRating:
      reviews.reduce((a, r) => a + r.rating, 0) / (reviews.length || 1),
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  data.forEach(r => stats.distribution[r.rating]++);

  res.json({ reviews: data, stats });
});

/**
 * POST /reviews
 */
// router.post('/', async (req, res) => {
//   const { reviewerId, revieweeId, rating, comment, skillId } = req.body;

//   const review = await Review.create({
//     reviewerId,
//     revieweeId,
//     rating,
//     comment,
//     skillId,
//   });

//   res.status(201).json(review);
// });

/**
 * POST /reviews/:id/report
 */
router.post('/:id/report', async (req, res) => {
  const { reason, reporterId } = req.body;

  await Review.findByIdAndUpdate(req.params.id, {
    flaggedAt: new Date(),
    flagReason: reason,
    flagReporterId: reporterId,
  });

  res.json({ success: true });
});

module.exports = router;
