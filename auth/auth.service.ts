import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authConfig } from './config';
import { TenantContext } from '../middleware/tenant-context';
import { AppError } from '../types/error.types';

export class AuthService {
  async generateTokens(userId: string, tenantId: string, roles: string[]): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, tenantId, roles),
      this.generateRefreshToken()
    ]);

    await this.storeRefreshToken(refreshToken, userId, tenantId);

    return { accessToken, refreshToken };
  }

  private async generateAccessToken(
    userId: string,
    tenantId: string,
    roles: string[]
  ): Promise<string> {
    const payload = {
      sub: userId,
      tenantId,
      roles,
      type: 'access'
    };

    return jwt.sign(payload, authConfig.jwt.secret, {
      expiresIn: authConfig.jwt.accessTokenExpiration,
      algorithm: authConfig.jwt.algorithm,
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience,
      jwtid: crypto.randomBytes(16).toString('hex')
    });
  }

  private async generateRefreshToken(): Promise<string> {
    return crypto.randomBytes(authConfig.refreshToken.length).toString('hex');
  }

  private async storeRefreshToken(
    token: string,
    userId: string,
    tenantId: string
  ): Promise<void> {
    await RefreshToken.create({
      token: await bcrypt.hash(token, authConfig.password.saltRounds),
      userId,
      tenantId,
      expiresAt: new Date(Date.now() + authConfig.refreshToken.cookieMaxAge)
    });
  }

  async validatePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, authConfig.password.saltRounds);
  }

  async validatePasswordStrength(password: string): Promise<void> {
    const errors: string[] = [];

    if (password.length < authConfig.password.minLength) {
      errors.push(`Password must be at least ${authConfig.password.minLength} characters long`);
    }

    if (authConfig.password.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (authConfig.password.requireSymbols && !/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain at least one symbol');
    }

    if (authConfig.password.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (authConfig.password.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (errors.length > 0) {
      throw new AppError('INVALID_PASSWORD', errors.join(', '));
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const storedToken = await RefreshToken.findOne({
      where: {
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [{ model: User }]
    });

    if (!storedToken) {
      throw new AppError('INVALID_TOKEN', 'Invalid or expired refresh token');
    }

    const isValid = await bcrypt.compare(refreshToken, storedToken.token);
    if (!isValid) {
      throw new AppError('INVALID_TOKEN', 'Invalid refresh token');
    }

    // Generate new access token
    return this.generateAccessToken(
      storedToken.userId,
      storedToken.tenantId,
      storedToken.user.roles
    );
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await RefreshToken.destroy({
      where: {
        token: await bcrypt.hash(token, authConfig.password.saltRounds)
      }
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await RefreshToken.destroy({
      where: { userId }
    });
  }
}
