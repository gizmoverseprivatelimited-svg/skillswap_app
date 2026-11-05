const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const GroupClass = require('../../models/GroupClass');
const ClassEnrollment = require('../../models/ClassEnrollment');
const User = require('../../models/User');
const PointTransaction = require('../../models/PointTransaction');
const SkillSwap = require('../../models/SkillSwap');
const { broadcastEvent, emitToUser } = require('../../socket');
const { isBlockedBetween } = require('../user');

// Multer storage for class cover images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './assets/uploads/classes';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = file.originalname ? path.extname(file.originalname) : '.jpg';
    cb(null, 'cover-' + uniqueSuffix + (ext || '.jpg'));
  },
});

const uploadCover = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Multer storage for class attachments (assignments/submissions)
const attachmentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './assets/uploads/attachments';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = file.originalname ? path.extname(file.originalname) : '';
    cb(null, 'file-' + uniqueSuffix + ext);
  },
});

const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

/** Helper to format class object */
function formatClass(c) {
  return {
    id: c._id.toString(),
    _id: c._id.toString(),
    teacherId: c.teacherId ? (c.teacherId._id ? c.teacherId._id.toString() : c.teacherId.toString()) : '',
    title: c.title,
    description: c.description,
    category: c.category,
    subCategory: c.subCategory || '',
    level: c.level,
    coverImageUrl: c.coverImageUrl || 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=800',
    startISO: c.startISO,
    endISO: c.endISO,
    sessionType: c.sessionType || 'single',
    billingCycle: c.billingCycle || 'one_time',
    sessionCount: c.sessionCount || 1,
    scheduleDays: c.scheduleDays || [],
    maxCapacity: c.maxCapacity,
    seatPriceCredits: c.seatPriceCredits,
    status: c.status,
    isLive: !!c.isLive,
    hasStarted: !!c.hasStarted,
    startedAt: c.startedAt || '',
    hmsRoomId: c.hmsRoomId || '',
    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    announcements: c.announcements || [],
    assignments: c.assignments || [],
    recordings: c.recordings || [],
  };
}

/** Helper to format enrollment object */
function formatEnrollment(e) {
  return {
    id: e._id.toString(),
    _id: e._id.toString(),
    classId: e.classId ? (e.classId._id ? e.classId._id.toString() : e.classId.toString()) : '',
    studentId: e.studentId ? (e.studentId._id ? e.studentId._id.toString() : e.studentId.toString()) : '',
    enrolledAt: e.enrolledAt,
    status: e.status,
    paymentTxnId: e.paymentTxnId,
  };
}

/**
 * POST /classes/upload-cover
 * Upload class cover image via Multer
 */
router.post('/upload-cover', uploadCover.single('coverImage'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const coverUrl = `/uploads/classes/${req.file.filename}`;
    res.json({ coverUrl, filename: req.file.filename });
  } catch (err) {
    console.error('[POST /classes/upload-cover error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes/upload-attachment
 * Upload file for assignment or submission
 */
router.post('/upload-attachment', uploadAttachment.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/attachments/${req.file.filename}`;
    res.json({ fileUrl, filename: req.file.filename });
  } catch (err) {
    console.error('[POST /classes/upload-attachment error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /classes
 * Get all group classes
 */
router.get('/', async (req, res) => {
  try {
    const classes = await GroupClass.find().sort({ createdAt: -1 });
    res.json(classes.map(formatClass));
  } catch (err) {
    console.error('[GET /classes error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /classes/enrollments
 * Get all enrollments
 */
router.get('/enrollments', async (req, res) => {
  try {
    const enrollments = await ClassEnrollment.find();
    res.json(enrollments.map(formatEnrollment));
  } catch (err) {
    console.error('[GET /classes/enrollments error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes
 * Create a new group class (supports JSON or multipart form with multer)
 */
router.post('/', uploadCover.single('coverImage'), async (req, res) => {
  try {
    let { teacherId, title, description, category, subCategory, level, coverImageUrl, startISO, endISO, sessionType, billingCycle, sessionCount, scheduleDays, maxCapacity, seatPriceCredits } = req.body;

    if (req.file) {
      coverImageUrl = `/uploads/classes/${req.file.filename}`;
    }

    if (!teacherId || !title || !description || !category || !level || !startISO || !endISO) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const cls = new GroupClass({
      teacherId,
      title,
      description,
      category,
      subCategory: subCategory || '',
      level,
      coverImageUrl: coverImageUrl || 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=800',
      startISO,
      endISO,
      sessionType: sessionType || 'single',
      billingCycle: billingCycle || 'one_time',
      sessionCount: Number(sessionCount) || 1,
      scheduleDays: Array.isArray(scheduleDays) ? scheduleDays : (typeof scheduleDays === 'string' ? JSON.parse(scheduleDays) : []),
      maxCapacity: Number(maxCapacity) || 10,
      seatPriceCredits: Number(seatPriceCredits) || 0,
      status: 'open',
    });

    await cls.save();
    broadcastEvent('class_updated', { classId: cls._id.toString(), action: 'created' });
    res.status(201).json(formatClass(cls));
  } catch (err) {
    console.error('[POST /classes error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes/:id/enroll
 * Enroll student in a class
 */
router.post('/:id/enroll', async (req, res) => {
  try {
    const { studentId } = req.body;
    const classId = req.params.id;

    const cls = await GroupClass.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (cls.status !== 'open') return res.status(400).json({ error: 'Class is not open' });

    // Verify blocking status between student and teacher
    const teacherId = cls.teacherId ? (cls.teacherId._id ? cls.teacherId._id.toString() : cls.teacherId.toString()) : '';
    if (teacherId && studentId) {
      const isBlocked = await isBlockedBetween(studentId, teacherId);
      if (isBlocked) {
        return res.status(403).json({ error: 'You cannot enroll in a class hosted by a user who is blocked or has blocked you.' });
      }
    }

    const activeEnrollmentsCount = await ClassEnrollment.countDocuments({ classId, status: 'enrolled' });
    if (activeEnrollmentsCount >= cls.maxCapacity) {
      return res.status(400).json({ error: 'Class is full' });
    }

    const existing = await ClassEnrollment.findOne({ classId, studentId, status: 'enrolled' });
    if (existing) {
      return res.status(400).json({ error: 'Already enrolled' });
    }

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    let discountRate = 0;
    if (student.premiumTier && student.premiumTier !== 'free') {
      if (student.premiumTier === 'elite' || student.premiumTier === 'yearly') {
        discountRate = 0.20;
      } else if (student.premiumTier === 'premium' || student.premiumTier === 'quarterly') {
        discountRate = 0.15;
      } else {
        discountRate = 0.10;
      }
    }
    const baseCost = cls.seatPriceCredits || 0;
    const cost = Math.max(0, Math.round(baseCost * (1 - discountRate)));

    if (cost > 0) {
      if (student.credits < cost) {
        return res.status(400).json({ error: 'Not enough credits' });
      }
      student.credits -= cost;
      await student.save();

      // Record transaction
      const txn = new PointTransaction({
        userId: studentId,
        amount: cost,
        type: 'redeemed',
        source: 'class_taught',
        description: `Enrolled in "${cls.title}"${discountRate > 0 ? ` (${Math.round(discountRate * 100)}% Premium discount)` : ''}`,
      });
      await txn.save();
    }

    const enrollment = new ClassEnrollment({
      classId,
      studentId,
      status: 'enrolled',
      enrolledAt: new Date().toISOString(),
    });
    await enrollment.save();

    const studentUser = await User.findById(studentId);
    const studentName = studentUser?.name || 'A student';
    const studentUsername = studentUser?.username ? `@${studentUser.username}` : '';
    const studentLabel = studentUsername ? `${studentName} (${studentUsername})` : studentName;

    const teacherIdStr = cls.teacherId ? (cls.teacherId._id ? cls.teacherId._id.toString() : cls.teacherId.toString()) : '';

    if (teacherIdStr && teacherIdStr !== String(studentId)) {
      emitToUser(teacherIdStr, 'new_notification', {
        category: 'class',
        title: 'New Student Enrolled! 🎓',
        body: `${studentLabel} has enrolled in your class "${cls.title}".`,
        metadata: {
          classId: cls._id.toString(),
          studentId: studentId.toString(),
          studentName,
          type: 'class-action',
          action: 'class_enrolled',
          link: '/class/my',
        },
      });
    }

    broadcastEvent('class_updated', {
      classId,
      action: 'enrolled',
      studentId,
      teacherId: teacherIdStr,
      classTitle: cls.title,
    });

    res.json({ success: true, enrollment: formatEnrollment(enrollment) });
  } catch (err) {
    console.error('[POST /classes/:id/enroll error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes/:id/cancel-enrollment
 * Cancel student's enrollment and refund credits
 */
router.post('/:id/cancel-enrollment', async (req, res) => {
  try {
    const { studentId } = req.body;
    const classId = req.params.id;

    const cls = await GroupClass.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    if (cls.hasStarted || cls.isLive) {
      return res.status(400).json({ error: 'Cannot cancel enrollment. The class has already started.' });
    }

    const enrollment = await ClassEnrollment.findOne({ classId, studentId, status: 'enrolled' });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    enrollment.status = 'cancelled';
    await enrollment.save();

    const cost = cls.seatPriceCredits || 0;
    if (cost > 0) {
      const student = await User.findById(studentId);
      if (student) {
        student.credits += cost;
        await student.save();
        const txn = new PointTransaction({
          userId: studentId,
          amount: cost,
          type: 'earned',
          source: 'refund',
          description: `Cancelled enrollment in "${cls.title}" — refund`,
        });
        await txn.save();
      }
    }

    const studentUser = await User.findById(studentId);
    const studentName = studentUser?.name || 'A student';
    const teacherIdStr = cls.teacherId ? (cls.teacherId._id ? cls.teacherId._id.toString() : cls.teacherId.toString()) : '';

    if (teacherIdStr && teacherIdStr !== String(studentId)) {
      emitToUser(teacherIdStr, 'new_notification', {
        category: 'class',
        title: 'Enrollment Cancelled',
        body: `${studentName} cancelled their enrollment in "${cls.title}".`,
        metadata: {
          classId: cls._id.toString(),
          studentId: studentId.toString(),
          studentName,
          type: 'class-action',
          action: 'class_cancel_enrollment',
          link: '/class/my',
        },
      });
    }

    broadcastEvent('class_updated', { classId, action: 'cancel_enrollment', studentId });

    res.json({ success: true });
  } catch (err) {
    console.error('[POST /classes/:id/cancel-enrollment error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes/:id/complete
 * Mark class as completed by teacher
 * - Sets status = 'completed'
 * - Calculates earnings: 80% of seatPriceCredits * number of enrolled students (or 50 credits if free)
 * - Records teacher's payout PointTransaction
 * - Updates enrolled students' ClassEnrollment status to 'attended'
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const classId = req.params.id;
    const { teacherId } = req.body;

    const cls = await GroupClass.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    if (cls.status === 'completed') {
      return res.json({ success: true, message: 'Class already completed', cls: formatClass(cls) });
    }

    const activeEnrollments = await ClassEnrollment.find({ classId, status: { $in: ['enrolled', 'attended'] } });
    const enrolledCount = activeEnrollments.length;

    cls.status = 'completed';
    cls.isLive = false;
    cls.hasStarted = true;
    await cls.save();

    await ClassEnrollment.updateMany({ classId, status: 'enrolled' }, { status: 'attended' });

    const seatPrice = cls.seatPriceCredits || 0;
    const teacherEarned = seatPrice <= 0 ? 50 * enrolledCount : Math.round(seatPrice * enrolledCount * 0.8);

    const actualTeacherId = teacherId || (cls.teacherId ? (cls.teacherId._id ? cls.teacherId._id.toString() : cls.teacherId.toString()) : '');

    if (actualTeacherId && teacherEarned > 0) {
      const txn = new PointTransaction({
        userId: actualTeacherId,
        amount: teacherEarned,
        type: 'earned',
        source: 'class_taught',
        description: `Taught group class "${cls.title}" — ${enrolledCount} student(s)`,
      });
      await txn.save();
    }

    const teacherUser = actualTeacherId ? await User.findById(actualTeacherId) : null;
    const teacherName = teacherUser?.name || 'Your teacher';

    // 🔔 Send real-time notification alert and popup banner to each enrolled student
    for (const enr of activeEnrollments) {
      const studentIdStr = enr.studentId ? (enr.studentId._id ? enr.studentId._id.toString() : enr.studentId.toString()) : '';
      if (studentIdStr && studentIdStr !== String(actualTeacherId)) {
        emitToUser(studentIdStr, 'new_notification', {
          category: 'class',
          title: 'Class Completed!',
          body: `"${cls.title}" has been marked as complete by ${teacherName}. Leave a review and share your feedback!`,
          metadata: {
            classId: cls._id.toString(),
            teacherId: actualTeacherId,
            teacherName,
            type: 'class-action',
            action: 'class_completed',
            link: `/class/${cls._id.toString()}`,
          },
        });
      }
    }

    broadcastEvent('class_updated', { classId, action: 'completed', status: 'completed', isLive: false });
    broadcastEvent('class_completed', { classId, classTitle: cls.title, enrolledCount, teacherEarned });

    res.json({ success: true, cls: formatClass(cls), teacherEarned, enrolledCount });
  } catch (err) {
    console.error('[POST /classes/:id/complete error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes/:id/cancel
 * Cancel class (by teacher or admin) and refund enrolled students
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const classId = req.params.id;
    const cls = await GroupClass.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const activeEnrollments = await ClassEnrollment.find({ classId, status: 'enrolled' });

    cls.status = 'cancelled';
    cls.isLive = false;
    await cls.save();

    await ClassEnrollment.updateMany({ classId, status: 'enrolled' }, { status: 'cancelled' });

    const cost = cls.seatPriceCredits || 0;
    for (const enr of activeEnrollments) {
      if (cost > 0) {
        const student = await User.findById(enr.studentId);
        if (student) {
          student.credits += cost;
          await student.save();

          const txn = new PointTransaction({
            userId: enr.studentId,
            amount: cost,
            type: 'earned',
            source: 'refund',
            description: `Class "${cls.title}" cancelled — refund`,
          });
          await txn.save();
        }
      }
    }

    broadcastEvent('class_updated', { classId, action: 'cancelled' });

    res.json({ success: true, refundedCount: activeEnrollments.length });
  } catch (err) {
    console.error('[POST /classes/:id/cancel error]', err);
    res.status(500).json({ error: err.message });
  }
});

/** Default 100ms Group Class credentials */
const DEFAULT_HOST_ROOM_CODE = process.env.HMS_GROUP_CLASS_HOST_ROOM_CODE || process.env.HMS_TEACHER_ROOM_CODE || process.env.HMS_GROUP_CLASS_ROOM_CODE || 'emq-ghiv-fud';
const DEFAULT_STUDENT_ROOM_CODE = process.env.HMS_GROUP_CLASS_STUDENT_ROOM_CODE || process.env.HMS_STUDENT_ROOM_CODE || 'cdw-aqqq-ryn';
const DEFAULT_HOST_AUTH_TOKEN = process.env.HMS_GROUP_CLASS_AUTH_TOKEN || process.env.HMS_TEACHER_AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2ZXJzaW9uIjoyLCJ0eXBlIjoiYXBwIiwiYXBwX2RhdGEiOm51bGwsImFjY2Vzc19rZXkiOiI2YTU2MWE1OGRiMWYzNTU1YTFlMDRjMTQiLCJyb2xlIjoiaG9zdCIsInJvb21faWQiOiI2YTc3MTg2ZTViYzkyZDJkZDAzZDg0YzIiLCJ1c2VyX2lkIjoiZTNmNThmZDUtMzQxOC00MmRhLWExNzgtYWQxYzZhNGE1MWMwIiwiZXhwIjoxNzg2Mjc2MzM0LCJqdGkiOiI1NTYxZjBmZC00YzQ5LTQxZDktYTk1NS1mYmEwMjRjMGZlMjUiLCJpYXQiOjE3ODYxODk5MzQsImlzcyI6IjZhNTYxYTU4ZGIxZjM1NTVhMWUwNGMxMiIsIm5iZiI6MTc4NjE4OTkzNCwic3ViIjoiYXBpIn0.zNP7m4770bc7eRkrAXdt04itYq5GtxwdnMqTN92rkbM';

/** Helper to generate 100ms room code for a class */
async function getOrCreateClassRoomCode(cls, isTeacher = false) {
  let roomCode = null;
  let roomId = cls.hmsRoomId;
  let authToken = null;

  const classTemplateId = process.env.HMS_TEACHER_CLASS_TEMPLATE_ID || process.env.HMS_GROUP_CLASS_TEMPLATE_ID || process.env.HMS_CLASS_TEMPLATE_ID || '6a7713068485531b71b617fd';

  if (process.env.HMS_ACCESS_KEY && process.env.HMS_SECRET) {
    try {
      const HMS = require('@100mslive/server-sdk');
      const hms = new HMS.SDK(process.env.HMS_ACCESS_KEY, process.env.HMS_SECRET);

      if (!roomId) {
        const room = await hms.rooms.create({
          name: `class-${cls._id.toString()}-${Date.now()}`,
          template_id: classTemplateId,
        });
        roomId = room.id;
        cls.hmsRoomId = roomId;
        await cls.save();
      }

      let roomCodes = [];
      try {
        for await (const c of hms.roomCodes.list(roomId)) {
          roomCodes.push(c);
        }
      } catch (e) {
        // Ignore if list fails
      }

      if (!roomCodes || roomCodes.length === 0) {
        try {
          const newCodes = await hms.roomCodes.create(roomId);
          if (Array.isArray(newCodes)) {
            roomCodes = newCodes;
          }
        } catch (e) {
          console.error('[100ms roomCodes.create error]', e);
        }
      }

      console.log(`[100ms Class RoomCodes for ${roomId}]:`, roomCodes);

      if (isTeacher) {
        // Teacher gets 'teacher' or 'host' role room code
        roomCode = roomCodes.find(c => c.role === 'teacher' || c.role === 'host')?.code
          || roomCodes[0]?.code;
      } else {
        // Students get 'student-on-stage' active stage role so teacher sees student and student sees teacher
        roomCode = roomCodes.find(c => c.role === 'student-on-stage')?.code
          || roomCodes.find(c => c.role === 'student' || c.role === 'guest' || c.role === 'joiner' || c.role === 'participant')?.code
          || roomCodes.find(c => c.role !== 'teacher' && c.role !== 'host')?.code
          || (roomCodes.length > 1 ? roomCodes[1].code : roomCodes[0].code);
      }
    } catch (err) {
      console.error('[100ms class room error]', err);
    }
  }

  if (!roomCode) {
    if (isTeacher) {
      roomCode = DEFAULT_HOST_ROOM_CODE;
      authToken = DEFAULT_HOST_AUTH_TOKEN;
    } else {
      roomCode = DEFAULT_STUDENT_ROOM_CODE;
      authToken = null;
    }
  }

  return { roomCode, roomId: roomId || cls._id.toString(), authToken, isTeacher };
}

/**
 * POST /classes/:id/start
 * Teacher starts the live class session
 */
router.post('/:id/start', async (req, res) => {
  try {
    const classId = req.params.id;
    const cls = await GroupClass.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    if (!cls.hasStarted && !cls.isLive && cls.startISO) {
      const startTime = new Date(cls.startISO).getTime();
      const now = Date.now();
      if (!isNaN(startTime) && now < startTime) {
        return res.status(400).json({
          error: `Cannot start class before scheduled date & time (${new Date(cls.startISO).toLocaleString()})`,
        });
      }
    }

    cls.isLive = true;
    cls.hasStarted = true;
    if (!cls.startedAt) {
      cls.startedAt = new Date().toISOString();
    }
    await cls.save();

    const { roomCode, roomId, authToken } = await getOrCreateClassRoomCode(cls, true);

    const teacher = await User.findById(cls.teacherId);
    const teacherName = teacher ? teacher.name : 'Teacher';

    const activeEnrollments = await ClassEnrollment.find({
      $or: [
        { classId: classId, status: { $ne: 'cancelled' } },
        ...(mongoose.Types.ObjectId.isValid(classId) ? [{ classId: new mongoose.Types.ObjectId(classId), status: { $ne: 'cancelled' } }] : [])
      ]
    });
    const rawStudentIds = activeEnrollments.map(e => {
      if (!e.studentId) return '';
      if (typeof e.studentId === 'object' && e.studentId._id) return e.studentId._id.toString();
      return e.studentId.toString();
    }).filter(Boolean);
    const enrolledStudentIds = [...new Set(rawStudentIds)];

    broadcastEvent('class_updated', { classId, action: 'started' });
    broadcastEvent('class_started', {
      classId,
      classTitle: cls.title,
      teacherId: cls.teacherId ? cls.teacherId.toString() : '',
      teacherName,
      roomCode,
      authToken,
      enrolledStudentIds,
    });

    // Send direct incoming_call and notification alert to every enrolled student
    enrolledStudentIds.forEach((studentId) => {
      if (studentId) {
        emitToUser(studentId, 'incoming_call', {
          swapId: classId,
          classId: classId,
          callerId: cls.teacherId ? cls.teacherId.toString() : '',
          callerName: teacherName,
          mode: 'video',
          title: `🔴 Live Class: ${cls.title}`,
          body: `${teacherName} has started the live video class "${cls.title}". Tap to join now!`,
          metadata: {
            swapId: classId,
            classId,
            type: 'class-video-call',
            mode: 'video',
            isClass: true,
            callerId: cls.teacherId ? cls.teacherId.toString() : '',
            callerName: teacherName,
            action: 'join_class',
          },
          createdAt: new Date().toISOString(),
        });

        emitToUser(studentId, 'new_notification', {
          category: 'class',
          title: `🔴 Live Class: ${cls.title}`,
          body: `${teacherName} is live now! Tap to join the video session.`,
          metadata: {
            swapId: classId,
            classId,
            type: 'class-video-call',
            mode: 'video',
            isClass: true,
            action: 'join_class',
          },
        });
      }
    });

    res.json({ success: true, roomCode, roomId, authToken, isTeacher: true });
  } catch (err) {
    console.error('[POST /classes/:id/start error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes/:id/end, /classes/:id/end-call, /classes/:id/leave
 * Teacher/Host stops the live class video call (class status remains open until teacher marks complete in class details)
 */
const handleStopLiveCall = async (req, res) => {
  try {
    const classId = req.params.id;
    const cls = await GroupClass.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    cls.isLive = false;
    // Status is deliberately kept as cls.status (remains 'open')
    await cls.save();

    broadcastEvent('class_updated', { classId, action: 'call_ended', isLive: false, status: cls.status, hasStarted: !!cls.hasStarted, startedAt: cls.startedAt || '' });
    broadcastEvent('class_ended', { classId, classTitle: cls.title, hasStarted: !!cls.hasStarted, startedAt: cls.startedAt || '' });

    res.json({ success: true, isLive: false, status: cls.status, hasStarted: !!cls.hasStarted, startedAt: cls.startedAt || '' });
  } catch (err) {
    console.error('[handleStopLiveCall error]', err);
    res.status(500).json({ error: err.message });
  }
};

router.post('/:id/end', handleStopLiveCall);
router.post('/:id/end-call', handleStopLiveCall);
router.post('/:id/leave', handleStopLiveCall);

/**
 * POST /classes/:id/reopen
 * Reopen a completed class back to open status if needed
 */
router.post('/:id/reopen', async (req, res) => {
  try {
    const classId = req.params.id;
    const cls = await GroupClass.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    cls.status = 'open';
    cls.isLive = false;
    await cls.save();

    broadcastEvent('class_updated', { classId, action: 'reopened', status: 'open' });
    res.json({ success: true, status: 'open' });
  } catch (err) {
    console.error('[POST /classes/:id/reopen error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /classes/:id/100ms-room
 * Get 100ms room code for a class
 */
router.get('/:id/100ms-room', async (req, res) => {
  try {
    const classId = req.params.id;
    const { userId } = req.query;
    const cls = await GroupClass.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    if (cls.status === 'completed' || cls.status === 'cancelled') {
      return res.status(400).json({ error: 'This class has ended and the room is closed.', status: cls.status, isLive: false });
    }

    const teacherIdStr = cls.teacherId ? (cls.teacherId._id ? cls.teacherId._id.toString() : cls.teacherId.toString()) : '';
    const isTeacher = !!(userId && teacherIdStr && String(teacherIdStr) === String(userId));

    // Access control: Teacher starts class video call. Students can only join after teacher starts live class.
    if (!isTeacher && !cls.isLive) {
      return res.status(403).json({ error: 'The teacher has not started the live class video room yet. Please wait for the teacher to start.', status: cls.status, isLive: false });
    }

    const { roomCode, roomId, authToken } = await getOrCreateClassRoomCode(cls, isTeacher);

    res.json({ roomCode, roomId, authToken, teacherId: teacherIdStr, isTeacher, status: cls.status, isLive: !!cls.isLive });
  } catch (err) {
    console.error('[GET /classes/:id/100ms-room error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes/:id/announcements
 * Add an announcement to a class
 */
router.post('/:id/announcements', async (req, res) => {
  try {
    const { text, teacherId } = req.body;
    const cls = await GroupClass.findById(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    // Check if the teacherId is valid for this class
    if (String(cls.teacherId) !== String(teacherId)) {
      return res.status(403).json({ error: 'Only the class teacher can make announcements' });
    }

    cls.announcements.push({ text, createdAt: new Date() });
    await cls.save();

    broadcastEvent('class_updated', { classId: cls._id.toString(), action: 'announcement_added' });

    // Send notifications to enrolled students
    const activeEnrollments = await ClassEnrollment.find({ classId: cls._id, status: 'enrolled' });
    activeEnrollments.forEach(enr => {
      if (enr.studentId) {
        const studentIdStr = enr.studentId._id ? enr.studentId._id.toString() : enr.studentId.toString();
        emitToUser(studentIdStr, 'new_notification', {
          category: 'class',
          title: 'New Announcement 📢',
          body: `"${cls.title}" has a new announcement from the teacher.`,
          metadata: { classId: cls._id.toString(), type: 'class-action', action: 'announcement_added', link: `/class/${cls._id.toString()}` }
        });
      }
    });

    res.json({ success: true, cls: formatClass(cls), announcements: cls.announcements });
  } catch (err) {
    console.error('[POST /classes/:id/announcements error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /classes/:id/announcements/:announcementId
 * Delete an announcement from a class
 */
router.delete('/:id/announcements/:announcementId', async (req, res) => {
  try {
    const { teacherId } = req.body;
    const cls = await GroupClass.findById(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    if (String(cls.teacherId) !== String(teacherId)) {
      return res.status(403).json({ error: 'Only the class teacher can delete announcements' });
    }

    cls.announcements = cls.announcements.filter(a => String(a._id) !== req.params.announcementId);
    await cls.save();

    broadcastEvent('class_updated', { classId: cls._id.toString(), action: 'announcement_deleted' });

    res.json({ success: true, cls: formatClass(cls), announcements: cls.announcements });
  } catch (err) {
    console.error('[DELETE /classes/:id/announcements/:announcementId error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes/:id/assignments
 * Create a new assignment
 */
router.post('/:id/assignments', async (req, res) => {
  try {
    const { title, description, fileUrl, teacherId } = req.body;
    const cls = await GroupClass.findById(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    if (String(cls.teacherId) !== String(teacherId)) {
      return res.status(403).json({ error: 'Only the class teacher can add assignments' });
    }

    cls.assignments.push({ title, description, fileUrl, createdAt: new Date(), submissions: [] });
    await cls.save();

    broadcastEvent('class_updated', { classId: cls._id.toString(), action: 'assignment_added' });

    // Send notifications to enrolled students
    const activeEnrollments = await ClassEnrollment.find({ classId: cls._id, status: 'enrolled' });
    activeEnrollments.forEach(enr => {
      if (enr.studentId) {
        const studentIdStr = enr.studentId._id ? enr.studentId._id.toString() : enr.studentId.toString();
        emitToUser(studentIdStr, 'new_notification', {
          category: 'class',
          title: 'New Assignment 📝',
          body: `"${cls.title}" has a new assignment: ${title}`,
          metadata: { classId: cls._id.toString(), type: 'class-action', action: 'assignment_added', link: `/class/${cls._id.toString()}` }
        });
      }
    });

    res.json({ success: true, cls: formatClass(cls), assignments: cls.assignments });
  } catch (err) {
    console.error('[POST /classes/:id/assignments error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes/:id/assignments/:assignmentId/submit
 * Student submits an assignment
 */
router.post('/:id/assignments/:assignmentId/submit', async (req, res) => {
  try {
    const { studentId, fileUrl } = req.body;
    const cls = await GroupClass.findById(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const assignment = cls.assignments.id(req.params.assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    // Check if student is enrolled
    const enrollment = await ClassEnrollment.findOne({ classId: cls._id, studentId: studentId, status: 'enrolled' });
    if (!enrollment) return res.status(403).json({ error: 'You are not enrolled in this class' });

    assignment.submissions.push({ studentId, fileUrl, submittedAt: new Date() });
    await cls.save();

    broadcastEvent('class_updated', { classId: cls._id.toString(), action: 'assignment_submitted' });

    // Send notification to teacher
    const studentUser = await User.findById(studentId);
    const studentName = studentUser?.name || 'A student';
    const teacherIdStr = cls.teacherId ? (cls.teacherId._id ? cls.teacherId._id.toString() : cls.teacherId.toString()) : '';

    if (teacherIdStr) {
      emitToUser(teacherIdStr, 'new_notification', {
        category: 'class',
        title: 'New Assignment Submission ✅',
        body: `${studentName} has submitted the assignment for "${cls.title}".`,
        metadata: { classId: cls._id.toString(), type: 'class-action', action: 'assignment_submitted', link: `/class/${cls._id.toString()}` }
      });
    }

    res.json({ success: true, assignments: cls.assignments });
  } catch (err) {
    console.error('[POST /classes/:id/assignments/:assignmentId/submit error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /classes/webhook/100ms
 * Webhook receiver for 100ms events (e.g. recording success)
 */
router.post('/webhook/100ms', async (req, res) => {
  // 1. Send an immediate 200 OK to prevent 100ms from retrying
  res.status(200).send('OK');

  try {
    const event = req.body;

    // We care about all successful recording events
    const validEvents = ['beam.recording.success', 'recording.success', 'hls.recording.success', 'stream.recording.success', 'track.recording.success'];

    if (event && validEvents.includes(event.type) && event.data) {
      const roomId = event.data.room_id;

      // Find the class with this HMS Room ID
      let cls = await GroupClass.findOne({ hmsRoomId: roomId });

      if (cls) {
        let assets = event.data.recording_assets || [];

        // Handle flat webhook payload (beam.recording.success and hls.recording.success)
        if (assets.length === 0 && (event.data.recording_presigned_url || event.data.location || event.data.recording_url || event.data.recording_path)) {
          assets.push({
            url: event.data.recording_presigned_url || event.data.recording_url || event.data.location || event.data.recording_path,
            duration: event.data.duration || 0
          });
        }

        let newRecordings = false;

        for (const asset of assets) {
          // check if we already have it
          const exists = cls.recordings.find(r => r.url === asset.url);
          if (!exists && asset.url) {
            cls.recordings.push({
              url: asset.url,
              recordedAt: new Date(),
              duration: asset.duration || 0
            });
            newRecordings = true;
          }
        }

        if (newRecordings) {
          await cls.save();
          broadcastEvent('class_updated', { classId: cls._id.toString(), action: 'recording_added' });
        }
      } else {
        // If not a class, maybe it's a swap room
        const swap = await SkillSwap.findOne({ hmsRoomId: roomId });
        if (swap) {
          let assets = event.data.recording_assets || [];

          if (assets.length === 0 && (event.data.recording_presigned_url || event.data.location || event.data.recording_url || event.data.recording_path)) {
            assets.push({
              url: event.data.recording_presigned_url || event.data.recording_url || event.data.location || event.data.recording_path,
              duration: event.data.duration || 0
            });
          }

          let newRecordings = false;

          for (const asset of assets) {
            const exists = swap.recordings && swap.recordings.find(r => r.url === asset.url);
            if (!exists && asset.url) {
              if (!swap.recordings) swap.recordings = [];
              swap.recordings.push({
                url: asset.url,
                recordedAt: new Date(),
                duration: asset.duration || 0
              });
              newRecordings = true;
            }
          }

          if (newRecordings) {
            await swap.save();
            const reqId = String(swap.requesterId?._id || swap.requesterId || '');
            const recId = String(swap.recipientId?._id || swap.recipientId || '');
            if (reqId) emitToUser(reqId, 'swap_updated', swap);
            if (recId) emitToUser(recId, 'swap_updated', swap);
            broadcastEvent('swap_updated', swap);
          }
        }
      }
    }
  } catch (err) {
    console.error('[POST /classes/webhook/100ms error]', err);
  }
});

module.exports = router;
