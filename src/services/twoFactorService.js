const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { User } = require('../models');

class TwoFactorService {
  async generateSecret(user) {
    const secret = speakeasy.generateSecret({
      name: `Multi-Tenant App (${user.email})`
    });

    await user.update({
      twoFactorSecret: secret.base32,
      twoFactorEnabled: false,
      twoFactorPendingVerification: true
    });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl
    };
  }

  async verifySetup(user, token) {
    if (!user.twoFactorSecret || !user.twoFactorPendingVerification) {
      throw new Error('2FA setup not initiated');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 step before/after for time drift
    });

    if (verified) {
      await user.update({
        twoFactorEnabled: true,
        twoFactorPendingVerification: false
      });

      await SecurityAuditLog.create({
        userId: user.id,
        event: 'TWO_FACTOR_ENABLED',
        severity: 'medium'
      });
    }

    return verified;
  }

  async verify(user, token) {
    if (!user.twoFactorEnabled) {
      throw new Error('2FA not enabled');
    }

    return speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });
  }
}

module.exports = new TwoFactorService();
