const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const UserReport = require('../../models/UserReport');
const User = require('../../models/User');
const { emitToUser, broadcastEvent } = require('../../socket');

// POST /reports - Submit a new report
router.post('/', async (req, res) => {
  try {
    const { reporterId, reportedUserId, reason, description } = req.body;

    if (!reporterId || !reportedUserId || !reason || !description) {
      return res.status(400).json({ message: 'Missing required report fields' });
    }

    if (!mongoose.Types.ObjectId.isValid(reporterId) || !mongoose.Types.ObjectId.isValid(reportedUserId)) {
      return res.status(400).json({ message: 'Invalid reporter or reported user ID' });
    }

    const report = new UserReport({
      reporterId,
      reportedUserId,
      reason,
      description: description.trim(),
      status: 'pending',
    });

    await report.save();

    // Increment reported user's reportCount
    await User.findByIdAndUpdate(reportedUserId, {
      $inc: { reportCount: 1 },
    });

    const populated = await UserReport.findById(report._id)
      .populate('reporterId', 'name avatarUrl username')
      .populate('reportedUserId', 'name avatarUrl username');

    const formatted = formatReport(populated);
    broadcastEvent('report_created', formatted);

    res.status(201).json({
      message: 'Report submitted successfully',
      report: formatted,
    });
  } catch (error) {
    console.error('[Create Report Error]', error);
    res.status(500).json({ message: 'Server error submitting report' });
  }
});

// GET /reports - Fetch reports (with optional status filter)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const reports = await UserReport.find(filter)
      .populate('reporterId', 'name avatarUrl username')
      .populate('reportedUserId', 'name avatarUrl username')
      .sort({ createdAt: -1 });

    const formatted = reports.map(formatReport);
    res.json({ reports: formatted });
  } catch (error) {
    console.error('[Fetch Reports Error]', error);
    res.status(500).json({ message: 'Server error fetching reports' });
  }
});

// PATCH /reports/:id/resolve - Resolve report with action
router.patch('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note, adminId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid report ID' });
    }

    const statusMap = {
      warning: 'actioned',
      suspend: 'actioned',
      ban: 'actioned',
      dismiss: 'dismissed',
    };

    const status = statusMap[action] || 'actioned';

    const report = await UserReport.findByIdAndUpdate(
      id,
      {
        status,
        action,
        adminNote: note || '',
        reviewedAt: new Date(),
        reviewedBy: adminId && mongoose.Types.ObjectId.isValid(adminId) ? adminId : undefined,
      },
      { new: true }
    )
      .populate('reporterId', 'name avatarUrl username')
      .populate('reportedUserId', 'name avatarUrl username');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const targetUserId = report.reportedUserId?._id ? report.reportedUserId._id.toString() : (report.reportedUserId ? String(report.reportedUserId) : null);

    // Apply corresponding account status updates if action is ban or suspend
    if (action === 'ban' && targetUserId) {
      const updatedUser = await User.findByIdAndUpdate(targetUserId, {
        banStatus: 'banned',
        banReason: `Banned from report: ${report.reason} - ${note || report.description}`,
        bannedAt: new Date(),
        suspendedUntil: null,
        daysSuspended: null,
      }, { new: true });
      if (updatedUser) {
        broadcastEvent('user_updated', updatedUser);
        emitToUser(targetUserId, 'user_banned', { userId: targetUserId, banStatus: 'banned', reason: report.reason, user: updatedUser });
        emitToUser(targetUserId, 'user_updated', updatedUser);
      }
    } else if (action === 'suspend' && targetUserId) {
      const numDays = Math.max(1, parseInt(req.body.days, 10) || 7);
      const suspendedUntil = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000);
      const updatedUser = await User.findByIdAndUpdate(targetUserId, {
        banStatus: 'suspended',
        banReason: `Suspended from report: ${report.reason} - ${note || report.description}`,
        bannedAt: new Date(),
        suspendedUntil,
        daysSuspended: numDays,
      }, { new: true });
      if (updatedUser) {
        broadcastEvent('user_updated', updatedUser);
        emitToUser(targetUserId, 'user_suspended', {
          userId: targetUserId,
          banStatus: 'suspended',
          reason: report.reason,
          suspendedUntil,
          daysSuspended: numDays,
          user: updatedUser,
        });
        emitToUser(targetUserId, 'user_updated', updatedUser);
      }
    }

    const formatted = formatReport(report);
    broadcastEvent('report_updated', formatted);
    broadcastEvent('report_resolved', formatted);

    res.json({
      message: 'Report resolved successfully',
      report: formatted,
    });
  } catch (error) {
    console.error('[Resolve Report Error]', error);
    res.status(500).json({ message: 'Server error resolving report' });
  }
});

function formatReport(r) {
  if (!r) return null;
  return {
    id: r._id.toString(),
    reporterId: r.reporterId?._id?.toString() || '',
    reporterName: r.reporterId?.name || 'Unknown',
    reporterAvatar: r.reporterId?.avatarUrl || '',
    reportedUserId: r.reportedUserId?._id?.toString() || '',
    reportedUserName: r.reportedUserId?.name || 'Unknown',
    reportedUserAvatar: r.reportedUserId?.avatarUrl || '',
    reason: r.reason,
    description: r.description,
    status: r.status,
    action: r.action,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    adminNote: r.adminNote,
  };
}

module.exports = router;
