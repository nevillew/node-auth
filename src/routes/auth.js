const express = require('express');
const passport = require('passport');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { tokenHandler } = require('../middleware/auth');
const { User } = require('../models');
const router = express.Router();

// Local authentication
router.post('/login', 
  passport.authenticate('local'),
  tokenHandler,
  (req, res) => {
    res.json(res.locals.oauth.token);
  }
);

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

module.exports = router;
