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
    res.status(500).json({ 
      error: error.message,
      code: 'PASSKEY_REGISTRATION_ERROR'
    });
  }
});

router.post('/passkey/register/verify', authenticateHandler, async (req, res) => {
  try {
    const verified = await passKeyService.verifyRegistration(req.user, req.body);
    if (verified) {
      await req.user.update({ passKeyEnabled: true });
      res.json({ success: true });
    } else {
      res.status(400).json({ 
        error: 'Verification failed',
        code: 'PASSKEY_VERIFICATION_FAILED'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      code: 'PASSKEY_VERIFICATION_ERROR'
    });
  }
});

// Manage authenticators
router.get('/passkey/authenticators', authenticateHandler, async (req, res) => {
  try {
    const authenticators = await req.user.getAuthenticators({
      attributes: ['id', 'friendlyName', 'createdAt', 'lastUsedAt']
    });
    res.json(authenticators);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      code: 'AUTHENTICATOR_LIST_ERROR'
    });
  }
});

router.put('/passkey/authenticators/:id', authenticateHandler, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { friendlyName } = req.body;
    if (!friendlyName) {
      await t.rollback();
      return res.status(400).json({ 
        error: 'friendlyName is required',
        code: 'MISSING_FRIENDLY_NAME'
      });
    }

    const authenticator = await Authenticator.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      transaction: t
    });

    if (!authenticator) {
      await t.rollback();
      return res.status(404).json({ 
        error: 'Authenticator not found',
        code: 'AUTHENTICATOR_NOT_FOUND'
      });
    }

    await authenticator.update({ friendlyName }, { transaction: t });
    await t.commit();
    res.json(authenticator);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ 
      error: error.message,
      code: 'AUTHENTICATOR_UPDATE_ERROR'
    });
  }
});

router.delete('/passkey/authenticators/:id', authenticateHandler, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const authenticator = await Authenticator.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      transaction: t
    });

    if (!authenticator) {
      await t.rollback();
      return res.status(404).json({ 
        error: 'Authenticator not found',
        code: 'AUTHENTICATOR_NOT_FOUND'
      });
    }


    // Create security audit log
    await SecurityAuditLog.create({
      userId: req.user.id,
      event: 'PASSKEY_REVOKED',
      details: {
        authenticatorId: authenticator.id,
        friendlyName: authenticator.friendlyName,
        lastUsedAt: authenticator.lastUsedAt
      },
      severity: 'medium'
    }, { transaction: t });

    await authenticator.destroy({ transaction: t });
    await t.commit();
    res.status(204).send();
  } catch (error) {
    await t.rollback();
    res.status(500).json({ 
      error: error.message,
      code: 'AUTHENTICATOR_DELETION_ERROR'
    });
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

// Machine to machine token generation
router.post('/m2m/token', authenticateHandler, async (req, res) => {
  try {
    const { clientId, scopes } = req.body;

    // Verify client exists and is authorized for M2M
    const client = await OAuthClient.findOne({ 
      where: { 
        clientId,
        type: 'machine'
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found or not authorized for M2M' });
    }

    // Verify requested scopes are allowed for this client
    const allowedScopes = new Set(client.allowedScopes);
    const requestedScopes = new Set(scopes);
    const invalidScopes = [...requestedScopes].filter(s => !allowedScopes.has(s));

    if (invalidScopes.length > 0) {
      return res.status(403).json({ 
        error: 'Invalid scopes requested',
        invalidScopes 
      });
    }

    // Generate token with limited lifetime
    const token = await oauth2Server.generateToken({
      client,
      scope: scopes.join(' '),
      type: 'm2m',
      expiresIn: 3600 // 1 hour
    });

    // Create audit log
    await SecurityAuditLog.create({
      userId: req.user.id,
      event: 'M2M_TOKEN_GENERATED',
      details: {
        clientId: client.id,
        scopes,
        expiresAt: token.accessTokenExpiresAt
      },
      severity: 'medium'
    });

    res.json({
      access_token: token.accessToken,
      expires_in: 3600,
      scope: scopes.join(' '),
      token_type: 'Bearer'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/refresh', tokenHandler, (req, res) => {
  res.json(res.locals.oauth.token);
});

// Impersonation endpoints
router.post('/impersonate/start', authenticateHandler, async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Verify impersonator has permission
    const hasPermission = req.user.roles.some(role => 
      role.permissions.includes('impersonate')
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get target user
    const targetUser = await User.findByPk(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate impersonation token
    const token = jwt.sign(
      { 
        id: targetUser.id,
        impersonatorId: req.user.id 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create audit log
    await SecurityAuditLog.create({
      userId: req.user.id,
      event: 'IMPERSONATION_STARTED',
      details: {
        targetUserId: targetUser.id,
        targetEmail: targetUser.email
      },
      severity: 'high'
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/impersonate/stop', authenticateHandler, async (req, res) => {
  try {
    if (!req.token.impersonatorId) {
      return res.status(400).json({ error: 'Not in impersonation mode' });
    }

    // Generate new token for original user
    const token = jwt.sign(
      { id: req.token.impersonatorId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create audit log
    await SecurityAuditLog.create({
      userId: req.token.impersonatorId,
      event: 'IMPERSONATION_ENDED',
      details: {
        targetUserId: req.user.id,
        targetEmail: req.user.email
      },
      severity: 'high'
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
  try {
    const user = await User.findByPk(req.user.id);
    const result = await twoFactorService.generateSecret(user);
    res.json(result);
  } catch (error) {
    res.status(400).json({ 
      error: error.message,
      code: 'TWO_FACTOR_SETUP_FAILED'
    });
  }
});

// 2FA verify setup
router.post('/2fa/verify', authenticateHandler, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findByPk(req.user.id);
    
    const verified = await twoFactorService.verifySetup(user, token);
    
    if (verified) {
      return res.json({ 
        success: true,
        message: '2FA enabled successfully'
      });
    }
    
    res.status(400).json({ 
      error: 'Invalid verification code',
      code: 'INVALID_2FA_TOKEN'
    });
  } catch (error) {
    res.status(400).json({ 
      error: error.message,
      code: 'TWO_FACTOR_VERIFICATION_FAILED'
    });
  }
});

// Disable 2FA
router.post('/2fa/disable', authenticateHandler, async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    
    await twoFactorService.disable(user, currentPassword);
    
    res.json({ 
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    res.status(400).json({ 
      error: error.message,
      code: 'TWO_FACTOR_DISABLE_FAILED'
    });
  }
});

// 2FA login
router.post('/2fa/login', async (req, res) => {
  try {
    const { email, password, token, type = 'totp' } = req.body;
    
    const user = await User.findOne({ 
      where: { email },
      include: [{
        model: Tenant,
        through: { attributes: ['roles'] }
      }]
    });
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    // Check if 2FA is required by any of user's tenants
    const requires2FA = user.Tenants.some(tenant => 
      tenant.securityPolicy?.twoFactor?.required
    );

    if (user.twoFactorEnabled || requires2FA) {
      if (!token) {
        return res.status(401).json({ 
          error: '2FA token required',
          requires2FA: true
        });
      }

      const verified = await twoFactorService.verify(user, token, type);
      if (!verified) {
        return res.status(401).json({ error: 'Invalid 2FA token' });
      }

      // Update last verification time
      await user.update({ twoFactorLastVerifiedAt: new Date() });
    }

    // Generate token
    const authToken = await generateToken(user);

    // Create login history entry
    await LoginHistory.create({
      userId: user.id,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ 
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
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
