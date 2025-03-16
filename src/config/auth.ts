import OAuth2Server from 'oauth2-server';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { manager } from './database';
import { User, OAuthClient, OAuthToken, SecurityAuditLog } from '../models';

// Rate limiting configuration
// Brute force protection for login attempts
const passkeyRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many passkey registration attempts, please try again later',
  handler: async (req: Request, res: Response) => {
    await SecurityAuditLog.create({
      userId: (req as any).user?.id,
      event: 'PASSKEY_REGISTRATION_RATE_LIMIT',
      severity: 'high',
      details: {
        ip: req.ip
      }
    });
    res.status(429).json({ 
      error: 'Too many registration attempts',
      retryAfter: (req as any).rateLimit.resetTime
    });
  },
  keyGenerator: (req) => `${(req as any).user?.id || req.ip}:passkey-registration`
});

const twoFactorFailedAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  message: 'Too many failed 2FA attempts, please try again later',
  handler: async (req: Request, res: Response) => {
    await SecurityAuditLog.create({
      userId: (req as any).user?.id,
      event: 'TWO_FACTOR_RATE_LIMIT',
      severity: 'high',
      details: {
        ip: req.ip,
        attempts: 5
      }
    });
    res.status(429).json({ 
      error: 'Too many failed attempts',
      retryAfter: (req as any).rateLimit.resetTime
    });
  },
  keyGenerator: (req) => `${req.ip}:2fa-attempts`
});

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: 'Too many login attempts, please try again later',
  handler: async (req: Request, res: Response) => {
    const { email } = req.body;
    if (email) {
      const user = await User.findOne({ where: { email } });
      if (user) {
        const failedAttempts = user.failedLoginAttempts + 1;
        await user.update({ 
          failedLoginAttempts,
          accountLockedUntil: failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
        });
      }
    }
    res.status(429).json({ 
      error: 'Too many login attempts',
      retryAfter: (req as any).rateLimit.resetTime
    });
  },
  store: new RedisStore({
    prefix: 'login_limit:',
    sendCommand: (...args: any[]) => manager.getRedisClient().then(client => client.sendCommand(args))
  }),
  keyGenerator: (req) => `${req.body.email || req.ip}:login`
});

// General API rate limiting
const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many password reset attempts, please try again later',
  keyGenerator: (req) => `${req.body.email || req.ip}:password-reset`
});

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    prefix: 'api_limit:',
    sendCommand: (...args: any[]) => manager.getRedisClient().then(client => client.sendCommand(args))
  }),
  keyGenerator: (req) => {
    // Include tenant ID in rate limiting key if available
    const tenantId = req.headers['x-tenant'] || 'global';
    return `${tenantId}:${req.ip}`;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: (req as any).rateLimit.resetTime
    });
  }
});

// OAuth2 Server Model
interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret?: string;
  grants: string[];
  redirectUris: string[];
}

interface OAuthUser {
  id: string;
  email: string;
  password?: string;
  [key: string]: any;
}

interface OAuthToken {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  clientId: string;
  userId?: string;
  scopes?: string[];
}

const oauth2Model = {
  // Required for Password Grant
  getClient: async (clientId: string, clientSecret?: string): Promise<any> => {
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
  getUser: async (username: string, password: string): Promise<any> => {
    const user = await User.findOne({
      where: { email: username }
    });

    if (!user) return false;

    const validPassword = await bcrypt.compare(password, user.password as string);
    if (!validPassword) return false;

    return user;
  },

  // Required for Password Grant and Client Credentials
  saveToken: async (token: OAuthToken, client: OAuthClient, user?: OAuthUser): Promise<any> => {
    // Get user roles and associated scopes
    if (user) {
      const roles = await user.getRoles();
      const scopes = roles.reduce((acc: string[], role: any) => {
        return [...new Set([...acc, ...role.scopes])];
      }, []);

      const accessToken = await OAuthToken.create({
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        clientId: client.id,
        userId: user ? user.id : null,
        scopes
      });

      return {
        ...accessToken.toJSON(),
        client,
        user,
        scopes
      };
    }

    // Handle client credentials flow (no user)
    const accessToken = await OAuthToken.create({
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      clientId: client.id,
      scopes: []
    });

    return {
      ...accessToken.toJSON(),
      client,
      user: null,
      scopes: []
    };
  },

  // Required for Authentication
  getAccessToken: async (accessToken: string): Promise<any> => {
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
  getRefreshToken: async (refreshToken: string): Promise<any> => {
    return await OAuthToken.findOne({
      where: { refreshToken },
      include: [
        { model: OAuthClient, as: 'client' },
        { model: User, as: 'user' }
      ]
    });
  },

  // Required for Refresh Token Grant
  revokeToken: async (token: any): Promise<boolean> => {
    await OAuthToken.destroy({
      where: { refreshToken: token.refreshToken }
    });
    return true;
  },
  
  // Required for Scope verification
  verifyScope: async (token: any, scope: string): Promise<boolean> => {
    // If the token doesn't have scopes, it can't access any scoped resource
    if (!token.scopes || !token.scopes.length) {
      return false;
    }
    
    // Check if the token has all the requested scopes
    const requestedScopes = scope.split(' ');
    return requestedScopes.every(s => token.scopes.includes(s));
  }
};

// OAuth2 Server Configuration
const oauth2Server = new OAuth2Server({
  model: oauth2Model,
  accessTokenLifetime: 60 * 60, // 1 hour
  refreshTokenLifetime: 60 * 60 * 24 * 14, // 14 days
  allowBearerTokensInQueryString: true,
  requireClientAuthentication: {
    authorization_code: true,
    refresh_token: true
  },
  // Require PKCE for public clients
  requirePKCE: true,
  // Allow both S256 and plain challenges (but prefer S256)
  allowedPKCEMethods: ['S256', 'plain']
});

// Passport Configuration
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as any).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Local Strategy
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email: string, password: string, done) => {
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) return done(null, false, { message: 'Invalid credentials' });

      const validPassword = await bcrypt.compare(password, user.password as string);
      if (!validPassword) return done(null, false, { message: 'Invalid credentials' });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: "/auth/google/callback"
  },
  async (accessToken: string, refreshToken: string, profile: any, done) => {
    try {
      let user = await User.findOne({
        where: { 
          googleId: profile.id
        }
      });

      if (!user && profile.emails && profile.emails.length > 0) {
        // Try to find by email
        user = await User.findOne({
          where: { email: profile.emails[0].value }
        });
      }

      if (!user && profile.emails && profile.emails.length > 0) {
        // Create new user
        user = await User.create({
          email: profile.emails[0].value,
          googleId: profile.id,
          name: profile.displayName,
          avatar: profile.photos ? profile.photos[0].value : undefined
        });
      }

      // Convert to User type expected by Passport
      return done(null, user ? user as any : false);
    } catch (err) {
      return done(err);
    }
  }
));

export {
  oauth2Server,
  passport,
  passkeyRegistrationLimiter,
  twoFactorFailedAttemptLimiter,
  loginRateLimiter,
  passwordResetRateLimiter,
  apiRateLimiter
};