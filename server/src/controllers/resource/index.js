const express = require('express');
const Resource = require('../../models/Resource');
const User = require('../../models/User');
const router = express.Router();

/**
 * GET /api/resources
 */
// router.get('/', async (req, res) => {
//   try {
//     const resources = await Resource.find().sort({ publishedAt: -1 });

//     res.json(
//       resources.map(r => ({
//         id: r._id,
//         title: r.title,
//         description: r.description,
//         type: r.type,
//         url: r.url,
//         coverImageUrl: r.coverImageUrl,
//         categories: r.categories,
//         contributorId: r.contributorId,
//         contributorName: r.contributorName,
//         contributorAvatarUrl: r.contributorAvatarUrl,
//         difficulty: r.difficulty,
//         durationMinutes: r.durationMinutes,
//         formatBadge: r.formatBadge,
//         publishedAt: r.publishedAt,
//         endorsements: r.endorsements,
//         saves: r.saves,
//         tags: r.tags
//       }))
//     );
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


/**
 * GET /resources
 * Fetch all resources (sorted by engagement)
 */
router.get('/', async (req, res) => {
  try {
    const resources = await Resource.find()
      .sort({ endorsements: -1, saves: -1, createdAt: -1 })
      .lean();


      

    res.json({ resources });
  } catch (err) {
    console.error('[Resources] Fetch error', err);
    res.status(500).json({ message: 'Failed to fetch resources' });
  }
});

/**
 * POST /resources
 * Add new resource
 */
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      url,
      type,
      coverImageUrl,
      categories,
      difficulty,
      durationMinutes,
      formatBadge,
      tags,
      contributorId,
    } = req.body;

    if (!title || !description || !url || !categories?.length) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const contributor = await User.findById(contributorId);
    if (!contributor) {
      return res.status(404).json({ message: 'Contributor not found' });
    }

    const resource = await Resource.create({
      title: title.trim(),
      description: description.trim(),
      url: url.trim(),
      type,
      coverImageUrl,
      categories,
      contributorId,
      contributorName: contributor.name,
      contributorAvatarUrl: contributor.avatarUrl,
      difficulty,
      durationMinutes,
      formatBadge,
      publishedAt: new Date(),
      endorsements: 0,
      saves: 1,
      tags,
    });

    res.status(201).json(resource);
  } catch (err) {
    console.error('[Resources] Create error', err);
    res.status(500).json({ message: 'Failed to create resource' });
  }
});

/**
 * POST /resources/:id/endorse
 */
router.post('/:id/endorse', async (req, res) => {
  try {
    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      { $inc: { endorsements: 1 } },
      { new: true }
    );

    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    res.json(resource);
  } catch (err) {
    console.error('[Resources] Endorse error', err);
    res.status(500).json({ message: 'Failed to endorse resource' });
  }
});

/**
 * POST /resources/:id/save
 */
router.post('/:id/save', async (req, res) => {
  try {
    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      { $inc: { saves: 1 } },
      { new: true }
    );

    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    res.json(resource);
  } catch (err) {
    console.error('[Resources] Save error', err);
    res.status(500).json({ message: 'Failed to save resource' });
  }
});



module.exports = router;
