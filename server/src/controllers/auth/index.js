let express = require('express');
let bcrypt = require('bcryptjs');
let axios = require('axios');
let jwt = require('jsonwebtoken');
require('dotenv').config();
let User = require('../../models/User.js');
let { generateToken } = require('../../utils/jwt.js');
let Otp = require('../../models/Otp.js');
let { sendResetPasswordOtpEmail, sendLoginOtpEmail, sendVerificationOtpEmail } = require('../../utils/resend.js');

const router = express.Router();

const TWO_FACTOR_API_KEY = process.env.TWO_FACTOR_API_KEY;

const isEmail = (value) => value.includes('@');

// ─────────────────────────────────────────────
// 2Factor helpers
// ─────────────────────────────────────────────

/**
 * Send OTP via 2Factor.in (SMS only — phone numbers)
 * Returns the SessionID that must be stored to verify later.
 */
async function send2FactorOtp(phone) {
  if (!TWO_FACTOR_API_KEY) {
    throw new Error('2Factor API key not configured');
  }
  // Strip non-digit characters except leading +
  let cleanPhone = phone.replace(/[^\d+]/g, '');
  if (cleanPhone.startsWith('+')) {
    cleanPhone = cleanPhone.slice(1);
  }
  if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
    cleanPhone = cleanPhone.slice(1);
  }

  // Append /LETESKI_LOGIN_SIGNUP_OTP to use the registered LETESKI_LOGIN_SIGNUP_OTP template
  const url = `https://2factor.in/API/V1/${TWO_FACTOR_API_KEY}/SMS/${encodeURIComponent(cleanPhone)}/AUTOGEN/LETESKI_LOGIN_SIGNUP_OTP`;
  const response = await axios.get(url);
  if (response.data.Status !== 'Success') {
    throw new Error(response.data.Details || '2Factor OTP send failed');
  }
  return response.data.Details; // SessionID
}

/**
 * Verify OTP via 2Factor.in
 * Returns true if valid, false otherwise.
 */
async function verify2FactorOtp(sessionId, userOtp) {
  if (!TWO_FACTOR_API_KEY) {
    throw new Error('2Factor API key not configured');
  }
  try {
    const url = `https://2factor.in/API/V1/${TWO_FACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${encodeURIComponent(userOtp)}`;
    const response = await axios.get(url);
    return response.data.Status === 'Success';
  } catch (err) {
    console.warn('[2Factor Verify Check]', err.response?.data?.Details || err.message);
    return false;
  }
}

/**
 * Find an existing user by phone number across all common formats
 * (+91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX, 0XXXXXXXXXX, or with spaces)
 * and across User and UserVerification models.
 */
async function findUserByPhone(phoneInput) {
  if (!phoneInput) return null;
  const digits = String(phoneInput).replace(/\D/g, '');
  if (digits.length < 10) return null;

  const last10 = digits.slice(-10);
  const plus91 = `+91${last10}`;

  // 1. Prioritize exact match on normalized +91 format
  let user = await User.findOne({ phone: plus91 }).populate('skillsOffered');
  if (user) return user;

  // 2. Check exact 10-digit format
  user = await User.findOne({ phone: last10 }).populate('skillsOffered');
  if (user) return user;

  // 3. Check other common candidate formats
  const candidates = [
    `91${last10}`,
    `0${last10}`,
    `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`,
    String(phoneInput).trim(),
  ];
  user = await User.findOne({ phone: { $in: candidates } }).populate('skillsOffered');
  if (user) return user;

  // 4. Regex fallback ending with the 10 digits
  user = await User.findOne({ phone: new RegExp(`${last10}$`) }).populate('skillsOffered');
  if (user) return user;

  // 5. If not found in User.phone, check UserVerification collection
  try {
    const UserVerification = require('../../models/UserVerification.js');
    const verification = await UserVerification.findOne({
      $or: [
        { 'phone.phoneNumber': plus91 },
        { 'phone.phoneNumber': last10 },
        { 'phone.phoneNumber': { $in: candidates } },
        { 'phone.phoneNumber': new RegExp(`${last10}$`) },
      ],
    });
    if (verification && verification.userId) {
      user = await User.findById(verification.userId).populate('skillsOffered');
    }
  } catch (e) {
    console.warn('[findUserByPhone] UserVerification check error', e.message);
  }

  return user;
}

// ─────────────────────────────────────────────
// SEND SIGNUP VERIFICATION OTP (RESEND EMAIL)
// ─────────────────────────────────────────────
router.post('/send-signup-otp', async (req, res) => {
  try {
    const { email, username } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if username is valid and available
    if (username) {
      const cleanUsername = username.toLowerCase().trim();
      const usernameRegex = /^[a-z0-9_.-]{3,30}$/;
      if (!usernameRegex.test(cleanUsername)) {
        return res.status(400).json({
          message: 'Username must be 3-30 characters and contain only lowercase letters, numbers, dots, hyphens, or underscores',
        });
      }
      const existingUsername = await User.findOne({ username: cleanUsername });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    // Check if email is already registered with another account (case-insensitive)
    const escapedEmail = cleanEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const existingEmail = await User.findOne({
      email: { $regex: new RegExp('^' + escapedEmail + '$', 'i') },
    });
    if (existingEmail) {
      return res.status(400).json({
        message: 'This email is already registered with another account. Please sign in or use a different email.',
      });
    }

    // Invalidate prior signup OTPs for this email
    await Otp.deleteMany({ identifier: cleanEmail, purpose: 'signup_verification' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await Otp.create({
      identifier: cleanEmail,
      identifierType: 'email',
      code: hashedOtp,
      purpose: 'signup_verification',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    const sendResult = await sendVerificationOtpEmail(cleanEmail, otp);
    if (!sendResult.success) {
      return res.status(500).json({
        message: sendResult.error || 'Failed to send verification email. Please try again.',
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (err) {
    console.error('[SEND SIGNUP OTP ERROR]', err);
    res.status(500).json({ message: err.message || 'Failed to send verification OTP' });
  }
});

// ─────────────────────────────────────────────
// SIGN UP
// ─────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, username, phone, phoneToken, otpCode } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const usernameRegex = /^[a-z0-9_.-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        message:
          'Username must be 3-30 characters and contain only lowercase letters, numbers, dots, hyphens, or underscores',
      });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const cleanEmail = email ? email.toLowerCase().trim() : '';

    if (cleanEmail) {
      // Check if email already registered
      const escapedEmail = cleanEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const existingEmail = await User.findOne({
        email: { $regex: new RegExp('^' + escapedEmail + '$', 'i') },
      });
      if (existingEmail) {
        return res.status(400).json({
          message: 'This email is already registered with another account. Please sign in or use a different email.',
        });
      }

      // Verify OTP code for signup
      if (!otpCode) {
        return res.status(400).json({
          message: 'Email verification code is required. Please verify your email first.',
        });
      }

      const otpEntry = await Otp.findOne({
        identifier: cleanEmail,
        purpose: 'signup_verification',
      }).sort({ createdAt: -1 });

      if (!otpEntry) {
        return res.status(400).json({
          message: 'Verification code not found or expired. Please request a new code.',
        });
      }

      if (otpEntry.expiresAt && otpEntry.expiresAt < new Date()) {
        await otpEntry.deleteOne();
        return res.status(400).json({
          message: 'Verification code has expired. Please request a new one.',
        });
      }

      const isOtpValid = await bcrypt.compare(String(otpCode).trim(), otpEntry.code);
      if (!isOtpValid) {
        return res.status(400).json({
          message: 'Invalid verification code. Please check and try again.',
        });
      }

      await otpEntry.deleteOne();
    }

    let verifiedPhone = null;
    if (phoneToken) {
      try {
        const decoded = jwt.verify(phoneToken, process.env.JWT_SECRET);
        if (decoded.purpose === 'phone_registration' && decoded.phone) {
          verifiedPhone = decoded.phone;
        }
      } catch (tokenErr) {
        console.warn('[Signup] phoneToken invalid or expired', tokenErr.message);
      }
    } else if (phone) {
      verifiedPhone = String(phone).trim();
    }

    if (verifiedPhone) {
      const existingPhoneUser = await User.findOne({ phone: verifiedPhone });
      if (existingPhoneUser) {
        return res.status(400).json({
          message: 'A user with this mobile number already exists. Please log in.',
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: cleanEmail || undefined,
      name,
      username,
      password: hashedPassword,
      phone: verifiedPhone || undefined,
      isPhoneVerified: Boolean(verifiedPhone),
      isEmailVerified: Boolean(cleanEmail),
    });

    if (verifiedPhone) {
      try {
        await VerificationRequest.findOneAndUpdate(
          { userId: user._id, type: 'phone' },
          {
            userId: user._id,
            type: 'phone',
            details: `Verified via 2Factor SMS OTP (${verifiedPhone})`,
            status: 'verified',
            moderatedAt: new Date(),
          },
          { upsert: true, new: true }
        );
      } catch (verifErr) {
        console.warn('[Signup] VerificationRequest phone creation error:', verifErr.message);
      }
    }

    if (cleanEmail) {
      try {
        await VerificationRequest.findOneAndUpdate(
          { userId: user._id, type: 'email' },
          {
            userId: user._id,
            type: 'email',
            details: `Verified via Resend Email OTP (${cleanEmail})`,
            status: 'verified',
            moderatedAt: new Date(),
          },
          { upsert: true, new: true }
        );
      } catch (verifErr) {
        console.warn('[Signup] VerificationRequest email creation error:', verifErr.message);
      }
    }

    const token = generateToken(user._id);
    const userSafe = user.toObject();
    delete userSafe.password;
    res.json({ token, user: userSafe });
  } catch (err) {
    console.error('[SIGNUP ERROR]', err);
    res.status(500).json({ message: err.message || 'Signup failed' });
  }
});
// Helper to check and auto-unsuspend user if suspension period expired
async function verifyAndNormalizeBanStatus(user) {
  if (!user) return user;
  if (user.banStatus === 'suspended' && user.suspendedUntil) {
    const expiresAt = new Date(user.suspendedUntil);
    if (expiresAt <= new Date()) {
      user.banStatus = 'active';
      user.banReason = undefined;
      user.bannedAt = undefined;
      user.suspendedUntil = undefined;
      user.daysSuspended = undefined;
      await User.findByIdAndUpdate(user._id, {
        banStatus: 'active',
        banReason: null,
        bannedAt: null,
        suspendedUntil: null,
        daysSuspended: null,
      });
    }
  }
  return user;
}

// ─────────────────────────────────────────────
// SIGN IN
// ─────────────────────────────────────────────
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = await User.findOne({ email: email ? email.toLowerCase() : '' }).populate('skillsOffered');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    user = await verifyAndNormalizeBanStatus(user);

    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (err) {
    console.error('[SIGNIN ERROR]', err);
    res.status(500).json({ message: 'Signin failed' });
  }
});

// ─────────────────────────────────────────────
// OAUTH SIGN IN
// ─────────────────────────────────────────────
router.post('/oauth', async (req, res) => {
  try {
    const { provider, providerId, email, name, avatar } = req.body;

    // 1. Find user by OAuth provider ID
    let user = await User.findOne({
      oauthProvider: provider,
      oauthProviderId: providerId,
    });

    // 2. If not found by OAuth ID, try finding user by email
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        // Link OAuth credentials to existing user account
        user.oauthProvider = provider;
        user.oauthProviderId = providerId;
        if (avatar && !user.avatarUrl) {
          user.avatarUrl = avatar;
        }
        await user.save();
      }
    }

    // 3. If still no user exists, create a new user record
    if (!user) {
      const displayName = name || (email ? email.split('@')[0] : 'User');
      let baseName = displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!baseName || baseName.length < 3) baseName = 'user';
      let candidate = baseName;
      let suffix = 1;
      while (await User.exists({ username: candidate })) {
        candidate = `${baseName}${suffix}`;
        suffix++;
      }

      user = await User.create({
        email,
        name: displayName,
        username: candidate,
        avatarUrl: avatar,
        oauthProvider: provider,
        oauthProviderId: providerId,
      });
    }

    user = await verifyAndNormalizeBanStatus(user);
    user = await User.findById(user._id).populate('skillsOffered');
    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (err) {
    console.error('[OAUTH ERROR]', err);
    res.status(500).json({ message: 'OAuth login failed' });
  }
});

// ─────────────────────────────────────────────
// SEND OTP
// ─────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { identifier, userId, purpose } = req.body;
    console.log('[SEND OTP] identifier:', identifier);

    if (!identifier) {
      return res.status(400).json({ message: 'Identifier required' });
    }

    const identifierType = isEmail(identifier) ? 'email' : 'phone';
    let cleanIdentifier = '';

    if (identifierType === 'phone') {
      const digits = String(identifier).replace(/\D/g, '');
      if (digits.length < 10) {
        return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
      }
      const last10 = digits.slice(-10);
      cleanIdentifier = `+91${last10}`;

      const phoneVariants = [
        last10,
        `+91${last10}`,
        `91${last10}`,
        `0${last10}`,
        String(identifier).trim(),
      ];

      // Check if phone number is already registered with another account before sending OTP
      if (purpose === 'phone_verification' || userId) {
        const phoneFilter = {
          phone: { $in: phoneVariants },
        };
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
          phoneFilter._id = { $ne: new mongoose.Types.ObjectId(userId) };
        }
        const existingPhoneUser = await User.findOne(phoneFilter);
        if (existingPhoneUser) {
          return res.status(400).json({
            message: 'This mobile number is already registered to another account. Please use a different number.',
          });
        }
      }

      // Invalidate existing OTPs for any phone variant
      await Otp.deleteMany({ identifier: { $in: phoneVariants } });

      // ── PHONE: use 2Factor.in ──────────────────────────
      const sessionId = await send2FactorOtp(last10);
      console.log('[SEND OTP] 2Factor sessionId:', sessionId);

      await Otp.create({
        identifier: cleanIdentifier,
        identifierType: 'phone',
        sessionId,
        purpose: 'auth',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      });

      return res.json({ message: 'OTP sent to your phone via SMS' });

    } else {
      cleanIdentifier = identifier.trim().toLowerCase();
      await Otp.deleteMany({ identifier: cleanIdentifier });

      // ── EMAIL: generate and dispatch via Resend ────────────
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = await bcrypt.hash(otp, 10);

      await Otp.create({
        identifier: cleanIdentifier,
        identifierType: 'email',
        code: hashedOtp,
        purpose: 'auth',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      });

      const emailResult = await sendLoginOtpEmail(cleanIdentifier, otp);
      console.log(`[SEND OTP] Email OTP for ${cleanIdentifier}: ${otp} (sent via Resend: ${emailResult.success})`);

      return res.json({
        message: emailResult.success
          ? 'OTP sent to your email'
          : 'OTP generated. Check your email.',
        emailSent: emailResult.success,
        ...(process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY ? { devOtp: otp } : {}),
      });
    }
  } catch (err) {
    console.error('[SEND OTP ERROR]', err);
    res.status(500).json({ message: err.message || 'Failed to send OTP' });
  }
});

// ─────────────────────────────────────────────
// VERIFY OTP
// ─────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { identifier, code } = req.body;

    if (!identifier || !code) {
      return res.status(400).json({ message: 'Identifier and code required' });
    }

    const identifierType = isEmail(identifier) ? 'email' : 'phone';
    let cleanIdentifier = '';
    let otpEntry = null;

    if (identifierType === 'phone') {
      const digits = String(identifier).replace(/\D/g, '');
      if (digits.length < 10) {
        return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
      }
      const last10 = digits.slice(-10);
      cleanIdentifier = `+91${last10}`;

      const phoneVariants = [
        last10,
        `+91${last10}`,
        `91${last10}`,
        `0${last10}`,
        String(identifier).trim(),
      ];
      otpEntry = await Otp.findOne({
        identifier: { $in: phoneVariants },
        identifierType: 'phone',
      }).sort({ createdAt: -1 });
    } else {
      cleanIdentifier = identifier.trim().toLowerCase();
      otpEntry = await Otp.findOne({ identifier: cleanIdentifier });
    }

    if (!otpEntry) {
      return res.status(400).json({ message: 'OTP not found or not requested. Please request a new code.' });
    }

    if (otpEntry.expiresAt < new Date()) {
      await otpEntry.deleteOne();
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }

    let isValid = false;

    if (identifierType === 'phone') {
      // ── PHONE: verify via 2Factor.in ──────────────────
      if (!otpEntry.sessionId) {
        return res.status(400).json({ message: 'Session ID not found. Please resend OTP.' });
      }
      isValid = await verify2FactorOtp(otpEntry.sessionId, code);
    } else {
      // ── EMAIL: verify via local bcrypt ─────────────────
      if (!otpEntry.code) {
        return res.status(400).json({ message: 'OTP record invalid. Please resend OTP.' });
      }
      isValid = await bcrypt.compare(code, otpEntry.code);
    }

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid OTP code. Please check and try again.' });
    }

    // OTP verified — clean up
    await otpEntry.deleteOne();

    // Find existing user across models or create new
    let user = null;

    if (identifierType === 'email') {
      user = await User.findOne({ email: cleanIdentifier }).populate('skillsOffered');
    } else {
      user = await findUserByPhone(cleanIdentifier);
    }

    if (user) {
      console.log(`[VERIFY OTP] Matched existing user account: ${user._id} (${user.name || user.username}) for phone ${cleanIdentifier}`);
      
      // Ensure phone and isPhoneVerified are up-to-date on user record
      if (identifierType === 'phone') {
        let shouldSave = false;
        if (!user.isPhoneVerified) {
          user.isPhoneVerified = true;
          shouldSave = true;
        }

        // Only update user.phone if not set, or if changing to cleanIdentifier and not taken by another user
        if (user.phone !== cleanIdentifier) {
          const phoneOccupied = await User.findOne({ phone: cleanIdentifier, _id: { $ne: user._id } });
          if (!phoneOccupied) {
            user.phone = cleanIdentifier;
            shouldSave = true;
          } else {
            console.warn(`[VERIFY OTP] Phone ${cleanIdentifier} is already assigned to another user (${phoneOccupied._id}). Keeping user ${user._id} phone as ${user.phone}`);
          }
        }

        if (shouldSave) {
          try {
            await user.save();
          } catch (saveErr) {
            console.warn('[VERIFY OTP] user.save() warning (proceeding with login):', saveErr.message);
          }
        }
      }

      const token = generateToken(user._id);
      user = await verifyAndNormalizeBanStatus(user);
      const userSafe = user.toObject();
      delete userSafe.password;

      return res.json({ token, user: userSafe, isNewUser: false });
    }

    // If identifierType is phone and user is not registered: prompt them to create account
    if (identifierType === 'phone') {
      console.log(`[VERIFY OTP] New mobile number verified: ${cleanIdentifier}. Prompting user to create account.`);
      const phoneToken = jwt.sign(
        { phone: cleanIdentifier, purpose: 'phone_registration' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      return res.json({
        isNewUser: true,
        phone: cleanIdentifier,
        phoneToken,
        message: 'Mobile number verified successfully. Please enter your details to create an account.',
      });
    }

    // Fallback for email OTP if user not found: create basic user
    const name = cleanIdentifier.split('@')[0];
    let baseName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!baseName || baseName.length < 3) baseName = 'user';
    let candidate = baseName;
    let suffix = 1;
    while (await User.exists({ username: candidate })) {
      candidate = `${baseName}${suffix}`;
      suffix++;
    }

    const newUser = {
      name,
      username: candidate,
      email: cleanIdentifier,
      isEmailVerified: true,
    };
    user = await User.create(newUser);

    const token = generateToken(user._id);
    user = await verifyAndNormalizeBanStatus(user);
    const userSafe = user.toObject();
    delete userSafe.password;

    res.json({ token, user: userSafe, isNewUser: false });
  } catch (err) {
    console.error('[VERIFY OTP ERROR]', err);
    res.status(500).json({ message: err.message || 'OTP verification failed' });
  }
});

// ─────────────────────────────────────────────
// REQUEST PASSWORD RESET (SEND OTP VIA RESEND)
// ─────────────────────────────────────────────
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Valid email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ message: 'This email is not registered in Leteski' });
    }

    // 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Remove any previous pending reset OTP for this email
    await Otp.deleteMany({ identifier: cleanEmail, purpose: 'reset_password' });

    // Store in DB with 10 minute expiry
    await Otp.create({
      identifier: cleanEmail,
      identifierType: 'email',
      code: hashedOtp,
      purpose: 'reset_password',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    console.log(`[RESET] Generated reset OTP for ${cleanEmail}: ${otp}`);

    // Send email using Resend API
    const emailResult = await sendResetPasswordOtpEmail(cleanEmail, otp);

    const isDev = process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY;

    return res.json({
      success: true,
      message: emailResult.success
        ? 'A 6-digit password reset code has been sent to your email.'
        : emailResult.notConfigured
        ? 'Verification code generated. (RESEND_API_KEY is not configured in server/.env)'
        : 'Verification code generated. (Resend email delivery issue)',
      emailSent: emailResult.success,
      ...(isDev ? { devOtp: otp } : {}),
    });
  } catch (err) {
    console.error('[RESET ERROR]', err);
    res.status(500).json({ message: err.message || 'Failed to request password reset' });
  }
});

// ─────────────────────────────────────────────
// VERIFY RESET OTP
// ─────────────────────────────────────────────
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = String(code).trim();

    const otpEntry = await Otp.findOne({
      identifier: cleanEmail,
      purpose: 'reset_password',
    });

    if (!otpEntry) {
      return res.status(400).json({
        message: 'No active reset request found. Please request a new code.',
      });
    }

    if (otpEntry.expiresAt < new Date()) {
      await otpEntry.deleteOne();
      return res.status(400).json({
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    const isValid = await bcrypt.compare(cleanCode, otpEntry.code);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid verification code. Please check and try again.' });
    }

    // OTP verified! Generate a signed reset token valid for 15 minutes
    const resetToken = jwt.sign(
      { email: cleanEmail, purpose: 'reset_password' },
      process.env.JWT_SECRET || 'leteski-reset-secret',
      { expiresIn: '15m' }
    );

    return res.json({
      success: true,
      message: 'Code verified successfully.',
      resetToken,
    });
  } catch (err) {
    console.error('[VERIFY RESET OTP ERROR]', err);
    res.status(500).json({ message: err.message || 'Failed to verify reset code' });
  }
});

// ─────────────────────────────────────────────
// RESET PASSWORD (UPDATE PASSWORD)
// ─────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetToken, code, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();

    let authorized = false;

    // 1. Check via resetToken if provided
    if (resetToken) {
      try {
        const decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'leteski-reset-secret');
        if (decoded.purpose === 'reset_password' && decoded.email === cleanEmail) {
          authorized = true;
        }
      } catch (tokenErr) {
        // Token expired or invalid
      }
    }

    // 2. Or check via direct code if provided
    if (!authorized && code) {
      const otpEntry = await Otp.findOne({
        identifier: cleanEmail,
        purpose: 'reset_password',
      });
      if (otpEntry && otpEntry.expiresAt >= new Date()) {
        const isValid = await bcrypt.compare(String(code).trim(), otpEntry.code);
        if (isValid) authorized = true;
      }
    }

    if (!authorized) {
      return res.status(400).json({
        message: 'Invalid or expired reset session. Please verify your OTP code again.',
      });
    }

    // Find and update user password
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Clean up reset OTPs
    await Otp.deleteMany({ identifier: cleanEmail, purpose: 'reset_password' });

    console.log(`[RESET SUCCESS] Password reset for user: ${cleanEmail}`);

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    console.error('[RESET PASSWORD ERROR]', err);
    res.status(500).json({ message: err.message || 'Failed to reset password' });
  }
});

module.exports = router;
