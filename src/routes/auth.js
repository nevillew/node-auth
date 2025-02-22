const express = require('express');
const passport = require('passport');
const { tokenHandler } = require('../middleware/auth');
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

module.exports = router;
