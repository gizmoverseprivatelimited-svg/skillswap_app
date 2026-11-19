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


const DEMO_URL_MAP = {
  'https://fstoppers.com/lighting/ultimate-guide-portrait-lighting-2024-654321': 'https://photographylife.com/portrait-photography-lighting',
  'https://www.youtube.com/watch?v=OxFcbx6QyBc': 'https://react.dev/reference/react/hooks',
  'https://drive.google.com/file/d/spanish-deck': 'https://www.fluentu.com/blog/spanish/spanish-conversation-practice/',
  'https://notion.so/mobility-primer': 'https://www.healthline.com/health/fitness-exercise/morning-stretches',
  'https://www.figma.com/community/file/123456789': 'https://ui.shadcn.com/',
  'https://www.figma.com/community/file/1179782559585642674': 'https://ui.shadcn.com/',
  'https://stackshare.io/fullstack-cheats': 'https://roadmap.sh/full-stack',
};

const sanitizeResourceUrl = (url, title = '') => {
  if (!url) return 'https://roadmap.sh';
  const trimmed = url.trim();
  if (DEMO_URL_MAP[trimmed]) return DEMO_URL_MAP[trimmed];

  const lower = trimmed.toLowerCase();
  const lowerTitle = (title || '').toLowerCase();

  if (lower.includes('portrait-lighting') || lower.includes('654321') || lowerTitle.includes('portrait lighting')) {
    return 'https://photographylife.com/portrait-photography-lighting';
  }
  if (lower.includes('oxfcbx6qybc') || lowerTitle.includes('react hooks')) {
    return 'https://react.dev/reference/react/hooks';
  }
  if (lower.includes('spanish-deck') || lowerTitle.includes('spanish')) {
    return 'https://www.fluentu.com/blog/spanish/spanish-conversation-practice/';
  }
  if (lower.includes('mobility-primer') || lowerTitle.includes('mobility')) {
    return 'https://www.healthline.com/health/fitness-exercise/morning-stretches';
  }
  if (lower.includes('123456789') || lowerTitle.includes('figma components') || lowerTitle.includes('starter vault')) {
    return 'https://ui.shadcn.com/';
  }
  if (lower.includes('fullstack-cheats') || lowerTitle.includes('full-stack')) {
    return 'https://roadmap.sh/full-stack';
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

/**
 * GET /resources
 * Fetch all resources (sorted by engagement)
 */
router.get('/', async (req, res) => {
  try {
    const resources = await Resource.find()
      .sort({ endorsements: -1, saves: -1, createdAt: -1 })
      .lean();

    const sanitizedResources = resources.map(r => ({
      ...r,
      url: sanitizeResourceUrl(r.url, r.title)
    }));

    res.json({ resources: sanitizedResources });
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
