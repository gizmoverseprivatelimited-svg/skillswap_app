const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const axios = require('axios');
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { broadcastEvent } = require('../../socket');

const router = express.Router();
const VerificationRequest = require('../../models/VerificationRequest');

const verificationsUploadDir = path.resolve(__dirname, '../../../assets/uploads/verifications');
if (!fs.existsSync(verificationsUploadDir)) {
    fs.mkdirSync(verificationsUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync(verificationsUploadDir)) {
            fs.mkdirSync(verificationsUploadDir, { recursive: true });
        }
        cb(null, verificationsUploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname || '') || '.jpg';
        cb(null, uniqueName + ext);
    },
});

const uploadDocument = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        cb(null, true);
    },
});
const User = require('../../models/User');
const Otp = require('../../models/Otp');
const { sendVerificationOtpEmail } = require('../../utils/resend');

const TWO_FACTOR_API_KEY = process.env.TWO_FACTOR_API_KEY;

// ─────────────────────────────────────────────
// 1. GET MY VERIFICATIONS
// ─────────────────────────────────────────────
router.get('/my/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.json({ verifications: [], user: null });
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const verifications = await VerificationRequest.find({ userId: userObjectId });

        // Also check directly on User document (email, phone, linkedin)
        const user = await User.findById(userObjectId).select(
            'phone isPhoneVerified email isEmailVerified isLinkedInVerified isIdentityVerified isVerified linkedin updatedAt'
        );

        if (user) {
            if (user.isPhoneVerified && user.phone) {
                const hasPhoneVerif = verifications.some((v) => v.type === 'phone' && v.status === 'verified');
                if (!hasPhoneVerif) {
                    verifications.push({
                        userId: user._id,
                        type: 'phone',
                        details: `Verified: ${user.phone}`,
                        status: 'verified',
                        createdAt: user.updatedAt || new Date(),
                    });
                }
            }

            if (user.isEmailVerified && user.email) {
                const hasEmailVerif = verifications.some((v) => v.type === 'email' && v.status === 'verified');
                if (!hasEmailVerif) {
                    verifications.push({
                        userId: user._id,
                        type: 'email',
                        details: `Verified: ${user.email}`,
                        status: 'verified',
                        createdAt: user.updatedAt || new Date(),
                    });
                }
            }

            if (user.isLinkedInVerified) {
                const hasLinkedInVerif = verifications.some((v) => v.type === 'linkedin' && v.status === 'verified');
                if (!hasLinkedInVerif) {
                    verifications.push({
                        userId: user._id,
                        type: 'linkedin',
                        details: user.linkedin ? `Verified LinkedIn: ${user.linkedin}` : 'Verified via LinkedIn OAuth',
                        status: 'verified',
                        createdAt: user.updatedAt || new Date(),
                    });
                }
            }

            if (user.isIdentityVerified) {
                const hasIdentityVerif = verifications.some((v) => v.type === 'identity' && v.status === 'verified');
                if (!hasIdentityVerif) {
                    verifications.push({
                        userId: user._id,
                        type: 'identity',
                        details: 'Government ID verified',
                        status: 'verified',
                        createdAt: user.updatedAt || new Date(),
                    });
                }
            }
        }

        res.json({
            verifications,
            user: user ? {
                id: user._id,
                email: user.email,
                phone: user.phone,
                isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified,
                isLinkedInVerified: user.isLinkedInVerified,
                isIdentityVerified: user.isIdentityVerified,
                isVerified: user.isVerified,
            } : null,
        });
    } catch (error) {
        console.error('[Verifications Controller] Error:', error);
        res.status(500).json({ message: 'Failed to fetch verifications' });
    }
});

// ─────────────────────────────────────────────
// 2. SUBMIT DOCUMENT VERIFICATION (IDENTITY, ETC)
// ─────────────────────────────────────────────
router.post('/upload-document', uploadDocument.single('document'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const documentUrl = `/uploads/verifications/${req.file.filename}`;
        res.json({ documentUrl });
    } catch (error) {
        console.error('[Upload Document Error]', error);
        res.status(500).json({ message: 'Failed to upload document' });
    }
});

router.post('/submit', uploadDocument.single('document'), async (req, res) => {
    try {
        const { type, details, userId } = req.body;
        let documentUrl = req.body.documentUrl;

        if (req.file) {
            documentUrl = `/uploads/verifications/${req.file.filename}`;
        }

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        if (!documentUrl && type === 'identity') {
            return res.status(400).json({ message: 'Document image is required' });
        }

        const existing = await VerificationRequest.findOne({
            userId,
            type,
            status: 'pending',
        });

        if (existing) {
            return res.status(400).json({ message: 'A verification request is already pending review' });
        }

        await VerificationRequest.deleteMany({
            userId,
            type,
        });

        const verification = await VerificationRequest.create({
            userId,
            type,
            details: details || 'Government ID submitted',
            documentUrl,
            status: 'pending',
        });

        if (broadcastEvent) {
            broadcastEvent('new_verification_request', verification);
        }

        res.json({ verification, message: 'Document submitted successfully. We will review it shortly.' });
    } catch (error) {
        console.error('[Submit Verification Error]', error);
        res.status(500).json({ message: error.message || 'Failed to submit verification' });
    }
});

// ─────────────────────────────────────────────
// 3. VERIFY PHONE OTP (2FACTOR.IN)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// SEND PHONE VERIFICATION OTP (2FACTOR.IN)
// ─────────────────────────────────────────────
router.post('/send-phone-otp', async (req, res) => {
    try {
        const { phone, identifier, userId } = req.body;
        const rawNumber = String(phone || identifier || '').trim();
        const digits = rawNumber.replace(/\D/g, '');

        if (digits.length < 10) {
            return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
        }
        const last10 = digits.slice(-10);
        const cleanIdentifier = `+91${last10}`;

        const phoneVariants = [
            last10,
            `+91${last10}`,
            `91${last10}`,
            `0${last10}`,
            rawNumber,
        ];

        // Check if another account is already registered with this phone number BEFORE sending OTP
        const phoneFilter = {
            phone: { $in: phoneVariants },
        };
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            phoneFilter._id = { $ne: new mongoose.Types.ObjectId(userId) };
        }
        const existingUser = await User.findOne(phoneFilter);
        if (existingUser) {
            return res.status(400).json({
                message: 'This mobile number is already registered to another account. Please use a different number.',
            });
        }

        if (!TWO_FACTOR_API_KEY) {
            return res.status(500).json({ message: '2Factor API key not configured' });
        }

        // Invalidate previous OTPs for this phone number
        await Otp.deleteMany({ identifier: { $in: phoneVariants } });

        // Try registered template first, fallback to standard AUTOGEN
        let sessionId = null;
        try {
            const urlWithTemplate = `https://2factor.in/API/V1/${TWO_FACTOR_API_KEY}/SMS/${last10}/AUTOGEN/LETESKI_LOGIN_SIGNUP_OTP`;
            const resp = await axios.get(urlWithTemplate);
            if (resp.data.Status === 'Success') {
                sessionId = resp.data.Details;
            }
        } catch (templateErr) {
            console.warn('[send-phone-otp] Template send fallback:', templateErr.message);
        }

        if (!sessionId) {
            const fallbackUrl = `https://2factor.in/API/V1/${TWO_FACTOR_API_KEY}/SMS/${last10}/AUTOGEN/OTP1`;
            const resp = await axios.get(fallbackUrl);
            if (resp.data.Status !== 'Success') {
                return res.status(500).json({
                    message: resp.data.Details || 'Failed to send OTP via SMS',
                });
            }
            sessionId = resp.data.Details;
        }

        await Otp.create({
            identifier: cleanIdentifier,
            identifierType: 'phone',
            sessionId,
            purpose: 'auth',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });

        res.json({ success: true, message: 'OTP sent to your phone via SMS' });
    } catch (err) {
        console.error('[Send Phone OTP Error]', err.response?.data || err.message);
        res.status(500).json({ message: err.message || 'Failed to send phone OTP' });
    }
});

router.post('/verify-phone-otp', async (req, res) => {
    try {
        const { identifier, code, userId } = req.body;

        const otpEntry = await Otp.findOne({ identifier }).sort({ createdAt: -1 });
        if (!otpEntry || !otpEntry.sessionId) {
            return res.status(400).json({ message: 'Session ID not found. Please resend OTP.' });
        }

        if (!TWO_FACTOR_API_KEY) {
            return res.status(500).json({ message: '2Factor API key not configured' });
        }

        const url = `https://2factor.in/API/V1/${TWO_FACTOR_API_KEY}/SMS/VERIFY/${otpEntry.sessionId}/${code}`;
        const response = await axios.get(url);

        if (response.data.Status !== 'Success') {
            return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
        }

        // OTP verified
        await otpEntry.deleteOne();

        // Mark phone as verified on user document
        let updatedUser = null;
        try {
            updatedUser = await User.findByIdAndUpdate(
                userId,
                { phone: identifier, isPhoneVerified: true },
                { new: true }
            );
        } catch (dbErr) {
            if (dbErr.code === 11000) {
                return res.status(400).json({ message: 'This phone number is already registered to another account.' });
            }
            throw dbErr;
        }

        // Clean up pending verification requests for phone
        await VerificationRequest.findOneAndDelete({ userId, type: 'phone' });

        // Upsert verified record
        const verification = await VerificationRequest.findOneAndUpdate(
            { userId, type: 'phone' },
            {
                userId,
                type: 'phone',
                details: `Verified via OTP SMS (${identifier})`,
                status: 'verified',
                moderatedAt: new Date(),
            },
            { upsert: true, new: true }
        );

        res.json({ verification, user: updatedUser });
    } catch (err) {
        console.error('[Verify Phone OTP Error]', err.response?.data || err.message);
        if (err.response && err.response.data && err.response.data.Status === 'Error') {
            return res.status(400).json({ message: err.response.data.Details || 'Invalid OTP. Please try again.' });
        }
        res.status(500).json({ message: err.message || 'Failed to verify OTP' });
    }
});

// ─────────────────────────────────────────────
// 4. SEND EMAIL OTP (RESEND API)
// ─────────────────────────────────────────────
router.post('/send-email-otp', async (req, res) => {
    try {
        const { email, userId } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: 'Please enter a valid email address' });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Check if another account already has this email (case-insensitive)
        const escapedEmail = cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const emailFilter = {
            email: { $regex: new RegExp('^' + escapedEmail + '$', 'i') },
        };
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            emailFilter._id = { $ne: new mongoose.Types.ObjectId(userId) };
        }
        const existing = await User.findOne(emailFilter);
        if (existing) {
            return res.status(400).json({
                message: 'This email is already registered with another account. Please use a different email.',
            });
        }

        // Invalidate previous email verification OTPs for this address
        await Otp.deleteMany({ identifier: cleanEmail, purpose: 'email_verification' });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);

        await Otp.create({
            identifier: cleanEmail,
            identifierType: 'email',
            code: hashedOtp,
            purpose: 'email_verification',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });

        const sendResult = await sendVerificationOtpEmail(cleanEmail, otp);
        if (!sendResult.success) {
            return res.status(500).json({
                message: sendResult.error || 'Failed to send verification email via Resend',
            });
        }

        res.json({ success: true, message: 'Verification code sent to your email' });
    } catch (err) {
        console.error('[Send Email OTP Error]', err);
        res.status(500).json({ message: err.message || 'Failed to send email verification code' });
    }
});

// ─────────────────────────────────────────────
// 5. VERIFY EMAIL OTP
// ─────────────────────────────────────────────
router.post('/verify-email-otp', async (req, res) => {
    try {
        const { email, code, userId } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: 'Email and verification code are required' });
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanCode = String(code).trim();

        const otpEntry = await Otp.findOne({
            identifier: cleanEmail,
            purpose: 'email_verification',
        }).sort({ createdAt: -1 });

        if (!otpEntry) {
            return res.status(400).json({ message: 'No active OTP found. Please request a new code.' });
        }

        if (otpEntry.expiresAt && otpEntry.expiresAt < new Date()) {
            await otpEntry.deleteOne();
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        const isValid = await bcrypt.compare(cleanCode, otpEntry.code);
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid verification code. Please check and try again.' });
        }

        // Clean up OTP entry
        await otpEntry.deleteOne();

        const targetUserId = (userId && mongoose.Types.ObjectId.isValid(userId))
            ? new mongoose.Types.ObjectId(userId)
            : userId;

        // Check if another account already has this email
        const escapedEmail = cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const verifyFilter = {
            email: { $regex: new RegExp('^' + escapedEmail + '$', 'i') },
        };
        if (targetUserId) {
            verifyFilter._id = { $ne: targetUserId };
        }
        const existing = await User.findOne(verifyFilter);
        if (existing) {
            return res.status(400).json({
                message: 'This email is already registered with another account. Please use a different email.',
            });
        }

        // Update user record
        const updatedUser = await User.findByIdAndUpdate(
            targetUserId,
            { email: cleanEmail, isEmailVerified: true },
            { new: true }
        ).select('-password');

        // Upsert verified record in VerificationRequest
        const verification = await VerificationRequest.findOneAndUpdate(
            { userId: targetUserId, type: 'email' },
            {
                userId: targetUserId,
                type: 'email',
                details: `Verified via Resend Email OTP (${cleanEmail})`,
                status: 'verified',
                moderatedAt: new Date(),
            },
            { upsert: true, new: true }
        );

        res.json({ verification, user: updatedUser });
    } catch (err) {
        console.error('[Verify Email OTP Error]', err);
        res.status(500).json({ message: err.message || 'Failed to verify email OTP' });
    }
});

// ─────────────────────────────────────────────
// 6. LINKEDIN OAUTH VERIFICATION
// ─────────────────────────────────────────────

function getLinkedInCallbackUrl(req) {
    if (process.env.LINKEDIN_CALLBACK_URL) {
        return process.env.LINKEDIN_CALLBACK_URL;
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host');
    return `${protocol}://${host}/verifications/linkedin/callback`;
}

// INITIATE LINKEDIN AUTH
router.get('/linkedin/auth', (req, res) => {
    try {
        const { userId, redirectUrl } = req.query;
        const clientId = process.env.LINKEDIN_CLIENT_ID || '';
        const callbackUrl = getLinkedInCallbackUrl(req);

        const statePayload = Buffer.from(
            JSON.stringify({
                userId: userId || '',
                redirectUrl: redirectUrl || '',
                callbackUrl,
            })
        ).toString('base64');

        const linkedinAuthUrl =
            `https://www.linkedin.com/oauth/v2/authorization?response_type=code` +
            `&client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
            `&state=${encodeURIComponent(statePayload)}` +
            `&scope=${encodeURIComponent('openid profile email')}`;

        return res.redirect(linkedinAuthUrl);
    } catch (err) {
        console.error('[LinkedIn Auth Error]', err);
        return res.status(500).json({ message: 'Failed to initiate LinkedIn authorization' });
    }
});

// LINKEDIN OAUTH CALLBACK
router.get('/linkedin/callback', async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;

        let stateData = {};
        if (state) {
            try {
                stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
            } catch (e) {
                console.warn('[LinkedIn Callback] State parse error:', e.message);
            }
        }

        const { userId, redirectUrl, callbackUrl } = stateData;
        const targetRedirect = redirectUrl || '/verification';
        const sep = targetRedirect.includes('?') ? '&' : '?';

        if (error) {
            console.error('[LinkedIn Callback Error]', error, error_description);
            return res.redirect(
                `${targetRedirect}${sep}linkedin=error&message=${encodeURIComponent(error_description || error)}`
            );
        }

        if (!code) {
            return res.redirect(`${targetRedirect}${sep}linkedin=error&message=Authorization+code+missing`);
        }

        const clientId = process.env.LINKEDIN_CLIENT_ID || '';
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
        const effectiveCallback = callbackUrl || getLinkedInCallbackUrl(req);

        // Exchange code for access token
        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: String(code).trim(),
                redirect_uri: effectiveCallback,
                client_id: clientId,
                client_secret: clientSecret,
            }).toString(),
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            console.error('[LinkedIn OAuth] Access token exchange failed:', tokenData);
            const errMsg = tokenData.error_description || tokenData.error || 'Failed to exchange token with LinkedIn';
            return res.redirect(`${targetRedirect}${sep}linkedin=error&message=${encodeURIComponent(errMsg)}`);
        }

        // Fetch User Profile from OpenID UserInfo endpoint
        let profile = null;
        try {
            const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            if (userinfoRes.ok) {
                profile = await userinfoRes.json();
            } else {
                const meRes = await fetch('https://api.linkedin.com/v2/me', {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                });
                if (meRes.ok) {
                    profile = await meRes.json();
                }
            }
        } catch (fetchErr) {
            console.warn('[LinkedIn OAuth] Userinfo fetch error:', fetchErr.message);
        }

        const profileName =
            profile?.name ||
            [profile?.given_name, profile?.family_name].filter(Boolean).join(' ') ||
            profile?.localizedFirstName ||
            'LinkedIn User';
        const profileEmail = profile?.email || '';

        // Save verification to database if userId provided
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const targetObjectId = new mongoose.Types.ObjectId(userId);

            await VerificationRequest.findOneAndUpdate(
                { userId: targetObjectId, type: 'linkedin' },
                {
                    userId: targetObjectId,
                    type: 'linkedin',
                    details: `Verified LinkedIn: ${profileName}${profileEmail ? ` (${profileEmail})` : ''}`,
                    status: 'verified',
                    moderatedAt: new Date(),
                },
                { upsert: true, new: true }
            );

            await User.findByIdAndUpdate(targetObjectId, {
                isLinkedInVerified: true,
                linkedin: profileName,
            });
        }

        return res.redirect(
            `${targetRedirect}${sep}linkedin=verified&name=${encodeURIComponent(profileName)}`
        );
    } catch (err) {
        console.error('[LinkedIn Callback Fatal Error]', err);
        return res.redirect(`/verification?linkedin=error&message=${encodeURIComponent(err.message)}`);
    }
});

// DIRECT CODE VERIFY
router.post('/linkedin/verify-code', async (req, res) => {
    try {
        const { code, redirectUri, userId } = req.body;
        if (!code) {
            return res.status(400).json({ message: 'Authorization code is required' });
        }

        const clientId = process.env.LINKEDIN_CLIENT_ID || '';
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
        const effectiveCallback = redirectUri || getLinkedInCallbackUrl(req);

        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: String(code).trim(),
                redirect_uri: effectiveCallback,
                client_id: clientId,
                client_secret: clientSecret,
            }).toString(),
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            console.error('[LinkedIn verify-code] Token exchange failed:', tokenData);
            return res.status(400).json({
                message: tokenData.error_description || tokenData.error || 'Failed to exchange token with LinkedIn',
            });
        }

        let profile = null;
        try {
            const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            if (userinfoRes.ok) {
                profile = await userinfoRes.json();
            } else {
                const meRes = await fetch('https://api.linkedin.com/v2/me', {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                });
                if (meRes.ok) {
                    profile = await meRes.json();
                }
            }
        } catch (fetchErr) {
            console.warn('[LinkedIn OAuth] Userinfo fetch error:', fetchErr.message);
        }

        const profileName =
            profile?.name ||
            [profile?.given_name, profile?.family_name].filter(Boolean).join(' ') ||
            profile?.localizedFirstName ||
            'LinkedIn User';
        const profileEmail = profile?.email || '';

        let verification = null;
        let updatedUser = null;

        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const targetObjectId = new mongoose.Types.ObjectId(userId);

            verification = await VerificationRequest.findOneAndUpdate(
                { userId: targetObjectId, type: 'linkedin' },
                {
                    userId: targetObjectId,
                    type: 'linkedin',
                    details: `Verified LinkedIn: ${profileName}${profileEmail ? ` (${profileEmail})` : ''}`,
                    status: 'verified',
                    moderatedAt: new Date(),
                },
                { upsert: true, new: true }
            );

            updatedUser = await User.findByIdAndUpdate(
                targetObjectId,
                { isLinkedInVerified: true, linkedin: profileName },
                { new: true }
            ).select('-password');
        }

        return res.json({
            success: true,
            profile: { name: profileName, email: profileEmail },
            verification,
            user: updatedUser,
        });
    } catch (err) {
        console.error('[LinkedIn verify-code Error]', err);
        return res.status(500).json({ message: err.message || 'LinkedIn verification failed' });
    }
});

module.exports = router;
