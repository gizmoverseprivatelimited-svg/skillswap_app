const mongoose = require('mongoose');

const ClassEnrollmentSchema = new mongoose.Schema(
  {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupClass', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    enrolledAt: { type: String, default: () => new Date().toISOString() },
    status: { type: String, enum: ['enrolled', 'cancelled', 'attended'], default: 'enrolled' },
    paymentTxnId: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClassEnrollment', ClassEnrollmentSchema);
