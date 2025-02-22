const express = require('express');
const passport = require('passport');
const passKeyService = require('../services/passKeyService');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { tokenHandler } = require('../middleware/auth');
const { User } = require('../models');

const emailService = require('../services/emailService');
const router = express.Router();

// Local authentication
router.post('/login', async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    if (user) {
      // Check if account is locked
      if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
        const timeLeft = Math.ceil((user.accountLockedUntil - new Date()) / 1000 / 60);
        return res.status(423).json({
          error: `Account is locked. Try again in ${timeLeft} minutes.`
        });
      }

      // Reset failed attempts if last failure was more than 30 minutes ago
      if (user.lastFailedLoginAt && 
          (new Date() - user.lastFailedLoginAt) > (30 * 60 * 1000)) {
        await user.update({
          failedLoginAttempts: 0,
          lastFailedLoginAt: null
        });
      }
    }

    passport.authenticate('local', async (err, user, info) => {
      if (err) return next(err);
      
      if (!user) {
        // Increment failed attempts
        if (user) {
          const failedAttempts = user.failedLoginAttempts + 1;
          const updates = {
            failedLoginAttempts: failedAttempts,
            lastFailedLoginAt: new Date()
          };

          // Lock account after 5 failed attempts
          if (failedAttempts >= 5) {
            updates.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          }

          await user.update(updates);
        }
        
        return res.status(401).json(info);
      }

      // Reset failed attempts on successful login
      await user.update({
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        accountLockedUntil: null
      });

      // Generate token
      tokenHandler(req, res, () => {
        res.json(res.locals.oauth.token);
      });
    })(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Passkey registration
router.post('/passkey/register/options', authenticateHandler, async (req, res) => {
  try {
    const options = await passKeyService.generateRegistrationOptions(req.user);
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/passkey/register/verify', authenticateHandler, async (req, res) => {
  try {
    const verified = await passKeyService.verifyRegistration(req.user, req.body);
    if (verified) {
      await req.user.update({ passKeyEnabled: true });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Passkey authentication
router.post('/passkey/login/options', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ 
      where: { 
        email,
        passKeyEnabled: true 
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Passkey not enabled for this user' });
    }

    const options = await passKeyService.generateAuthenticationOptions(user);
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/passkey/login/verify', async (req, res) => {
  try {
    const { email, response } = req.body;
    const user = await User.findOne({ 
      where: { 
        email,
        passKeyEnabled: true 
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const verified = await passKeyService.verifyAuthentication(user, response);
    if (verified) {
      // Generate token
      req.user = user;
      tokenHandler(req, res, () => {
        res.json(res.locals.oauth.token);
      });
    } else {
      res.status(401).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    accessType: 'offline',
    prompt: 'consent'
  })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  tokenHandler,
  (req, res) => {
    res.json(res.locals.oauth.token);
  }
);

// OAuth2 token endpoints
router.post('/token', tokenHandler, (req, res) => {
  res.json(res.locals.oauth.token);
});

router.post('/refresh', tokenHandler, (req, res) => {
  res.json(res.locals.oauth.token);
});

// Logout endpoint
router.post('/logout', authenticateHandler, async (req, res) => {
  try {
    // Revoke current token
    await OAuthToken.update(
      { revoked: true },
      { where: { accessToken: req.token.accessToken } }
    );

    // Optionally revoke all user tokens
    if (req.body.allDevices) {
      await OAuthToken.update(
        { revoked: true },
        { where: { userId: req.user.id } }
      );
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2FA setup
router.post('/2fa/setup', authenticateHandler, async (req, res) => {
  const user = await User.findByPk(req.user.id);
  
  const secret = speakeasy.generateSecret({
    name: `Multi-Tenant App (${user.email})`
  });

  await user.update({
    twoFactorSecret: secret.base32,
    twoFactorEnabled: false
  });

  qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
    res.json({
      secret: secret.base32,
      qrCode: data_url
    });
  });
});

// 2FA verify
router.post('/2fa/verify', authenticateHandler, async (req, res) => {
  const { token } = req.body;
  const user = await User.findByPk(req.user.id);

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token
  });

  if (verified) {
    await user.update({ twoFactorEnabled: true });
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Invalid token' });
});

// 2FA login
router.post('/2fa/login', async (req, res) => {
  const { email, password, token } = req.body;
  
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

  if (user.twoFactorEnabled) {
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token
    });

    if (!verified) return res.status(401).json({ error: 'Invalid 2FA token' });
  }

  // Generate and return token
  const authToken = generateToken(user);
  res.json({ token: authToken });
});

// Email verification
router.post('/verify-email', async (req, res) => {
  const { email } = req.body;
  
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await user.update({
      verificationToken: token,
      verificationTokenExpires: expires
    });

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    await emailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationUrl
    );

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete email verification
router.post('/verify-email/confirm', async (req, res) => {
  const { token } = req.body;
  
  try {
    const user = await User.findOne({ 
      where: { 
        verificationToken: token,
        verificationTokenExpires: { [Sequelize.Op.gt]: new Date() }
      }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    await user.update({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null
    });

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Password reset request
router.post('/reset-password', passwordResetRateLimiter, async (req, res) => {
  const { email } = req.body;
  
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await user.update({
      resetToken: token,
      resetTokenExpires: expires
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    await emailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetUrl
    );

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete password reset
router.post('/reset-password/confirm', async (req, res) => {
  const { token, password } = req.body;
  
  try {
    const user = await User.findOne({ 
      where: { 
        resetToken: token,
        resetTokenExpires: { [Sequelize.Op.gt]: new Date() }
      }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    const hashedPassword = await bcrypt.hash(password, 10);
    
    await user.update({
      password: hashedPassword,
      resetToken: null,
      resetTokenExpires: null
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user preferences
router.put('/preferences', authenticateHandler, async (req, res) => {
  try {
    const { preferences } = req.body;
    const user = await User.findByPk(req.user.id);
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    await user.update({ preferences });
    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Track user activity
router.use(authenticateHandler, async (req, res, next) => {
  try {
    await User.update(
      { lastActivity: new Date() },
      { where: { id: req.user.id } }
    );
  } catch (error) {
    console.error('Activity tracking error:', error);
  }
  next();
});

module.exports = router;
