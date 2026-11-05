const mongoose = require('mongoose');

const GroupClassSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    subCategory: { type: String },
    level: { type: String, required: true },
    coverImageUrl: { type: String },
    startISO: { type: String, required: true },
    endISO: { type: String, required: true },
    sessionType: { type: String, enum: ['single', 'daily', 'weekly'], default: 'single' },
    billingCycle: { type: String, enum: ['one_time', 'monthly'], default: 'one_time' },
    sessionCount: { type: Number, default: 1 },
    scheduleDays: [{ type: String }],
    maxCapacity: { type: Number, required: true, default: 10 },
    seatPriceCredits: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['open', 'completed', 'cancelled'], default: 'open' },
    hmsRoomId: { type: String },
    isLive: { type: Boolean, default: false },
    hasStarted: { type: Boolean, default: false },
    startedAt: { type: String },
    announcements: [
      {
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      }
    ],
    assignments: [
      {
        title: { type: String, required: true },
        description: { type: String },
        fileUrl: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        submissions: [
          {
            studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            fileUrl: { type: String, required: true },
            submittedAt: { type: Date, default: Date.now },
          }
        ]
      }
    ],
    recordings: [
      {
        url: { type: String, required: true },
        recordedAt: { type: Date, default: Date.now },
        duration: { type: Number }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('GroupClass', GroupClassSchema);
