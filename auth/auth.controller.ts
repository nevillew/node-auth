import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { authConfig } from './config';
import { AppError } from '../types/error.types';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  login = async (req: Request, res: Response) => {
    const { email, password, tenantId } = req.body;

    // Validate user credentials
    const user = await User.findOne({
      where: { email },
      include: [{
        model: TenantUserMapping,
        where: { tenantId, status: 'active' }
      }]
    });

    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const isValid = await this.authService.validatePassword(
      password,
      user.hashedPassword
    );

    if (!isValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.authService.generateTokens(
      user.id,
      tenantId,
      user.TenantUserMapping.roles
    );

    // Set refresh token cookie
    res.cookie(
      authConfig.refreshToken.cookieName,
      refreshToken,
      authConfig.refreshToken.cookieOptions
    );

    // Return access token
    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        roles: user.TenantUserMapping.roles
      }
    });
  };

  logout = async (req: Request, res: Response) => {
    const refreshToken = req.cookies[authConfig.refreshToken.cookieName];
    
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    res.clearCookie(authConfig.refreshToken.cookieName);
    res.json({ success: true });
  };

  refresh = async (req: Request, res: Response) => {
    const refreshToken = req.cookies[authConfig.refreshToken.cookieName];
    
    if (!refreshToken) {
      throw new AppError('INVALID_TOKEN', 'Refresh token required');
    }

    const accessToken = await this.authService.refreshAccessToken(refreshToken);

    res.json({ accessToken });
  };

  changePassword = async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }

    // Validate current password
    const isValid = await this.authService.validatePassword(
      currentPassword,
      user.hashedPassword
    );

    if (!isValid) {
      throw new AppError('INVALID_PASSWORD', 'Current password is incorrect');
    }

    // Validate new password strength
    await this.authService.validatePasswordStrength(newPassword);

    // Update password
    const hashedPassword = await this.authService.hashPassword(newPassword);
    await user.update({ hashedPassword });

    // Revoke all refresh tokens
    await this.authService.revokeAllUserTokens(userId);

    res.json({ success: true });
  };
}
