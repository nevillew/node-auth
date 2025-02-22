const OAuth2Server = require('oauth2-server');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const { User, OAuthClient, OAuthToken } = require('../models');

// OAuth2 Server Model
const oauth2Model = {
  // Required for Password Grant
  getClient: async (clientId, clientSecret) => {
    const client = await OAuthClient.findOne({
      where: { clientId }
    });
    
    if (!client || (clientSecret && client.clientSecret !== clientSecret)) {
      return false;
    }
    
    return {
      id: client.id,
      grants: client.grants,
      redirectUris: client.redirectUris
    };
  },

  // Required for Password Grant
  getUser: async (username, password) => {
    const user = await User.findOne({
      where: { email: username }
    });

    if (!user) return false;

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return false;

    return user;
  },

  // Required for Password Grant and Client Credentials
  saveToken: async (token, client, user) => {
    const accessToken = await OAuthToken.create({
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        clientId: client.id,
        userId: user ? user.id : null
      }
    });

    return {
      ...accessToken,
      client,
      user
    };
  },

  // Required for Authentication
  getAccessToken: async (accessToken) => {
    const token = await OAuthToken.findOne({
      where: { accessToken },
      include: [
        { model: OAuthClient, as: 'client' },
        { model: User, as: 'user' }
      ]
    });

    if (!token) return false;

    return token;
  },

  // Required for Refresh Token Grant
  getRefreshToken: async (refreshToken) => {
    return await OAuthToken.findOne({
      where: { refreshToken },
      include: [
        { model: OAuthClient, as: 'client' },
        { model: User, as: 'user' }
      ]
    });
  },

  // Required for Refresh Token Grant
  revokeToken: async (token) => {
    await OAuthToken.destroy({
      where: { refreshToken: token.refreshToken }
    });
    return true;
  }
};

// OAuth2 Server Configuration
const oauth2Server = new OAuth2Server({
  model: oauth2Model,
  accessTokenLifetime: 60 * 60, // 1 hour
  refreshTokenLifetime: 60 * 60 * 24 * 14, // 14 days
  allowBearerTokensInQueryString: true
});

// Passport Configuration
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Local Strategy
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return done(null, false, { message: 'Invalid credentials' });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return done(null, false, { message: 'Invalid credentials' });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await prisma.user.findFirst({
        where: { 
          OR: [
            { googleId: profile.id },
            { email: profile.emails[0].value }
          ]
        }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: profile.emails[0].value,
            googleId: profile.id,
            name: profile.displayName,
            avatar: profile.photos[0].value
          }
        });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

module.exports = {
  oauth2Server,
  passport
};
