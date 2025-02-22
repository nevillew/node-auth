import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { authConfig } from './config';
import { AppError } from '../types/error.types';
import { TenantContext } from '../middleware/tenant-context';

// Configure JWT strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: authConfig.jwt.secret,
  issuer: authConfig.jwt.issuer,
  audience: authConfig.jwt.audience,
  algorithms: [authConfig.jwt.algorithm]
}, async (payload, done) => {
  try {
    const user = await User.findByPk(payload.sub);
    if (!user) {
      return done(null, false);
    }

    // Set tenant context
    TenantContext.setCurrentTenant(payload.tenantId);
    
    return done(null, {
      id: user.id,
      tenantId: payload.tenantId,
      roles: payload.roles
    });
  } catch (error) {
    return done(error, false);
  }
}));

export const authenticate = passport.authenticate('jwt', { session: false });

export const requireRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required');
    }

    const hasRole = roles.some(role => req.user.roles.includes(role));
    if (!hasRole) {
      throw new AppError('FORBIDDEN', 'Insufficient permissions');
    }

    next();
  };
};

export const validateTenantAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;
  const tenantId = req.headers['x-tenant-id'];

  if (!user || !tenantId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const hasAccess = await TenantUserMapping.findOne({
    where: {
      userId: user.id,
      tenantId: tenantId,
      status: 'active'
    }
  });

  if (!hasAccess) {
    throw new AppError('FORBIDDEN', 'No access to this tenant');
  }

  next();
};
