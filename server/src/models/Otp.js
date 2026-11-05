let mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema(
    {
        identifier: {
            type: String, // email or phone
            required: true,
            index: true,
        },
        identifierType: {
            type: String,
            enum: ['email', 'phone'],
            required: true,
        },
        // For phone OTPs via 2Factor — stores the SessionID returned by 2Factor API
        sessionId: {
            type: String,
        },
        // For email OTPs — stores the bcrypt-hashed local OTP code
        code: {
            type: String,
        },
        purpose: {
            type: String,
            enum: ['auth', 'reset_password', 'email_verification', 'signup_verification'],
            default: 'auth',
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Otp', OtpSchema);
