const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { User, SecurityAuditLog } = require('../models');
const logger = require('../config/logger');

class TwoFactorService {
  async generateSecret(user) {
    try {
      const secret = speakeasy.generateSecret({
        name: `Multi-Tenant App (${user.email})`,
        length: 32 // Increased security
      });

      // Generate backup codes
      const backupCodes = Array.from({length: 10}, () => 
        crypto.randomBytes(4).toString('hex')
      );

      // Hash backup codes before storing
      const hashedBackupCodes = backupCodes.map(code => 
        crypto.createHash('sha256').update(code).digest('hex')
      );

      await user.update({
        twoFactorSecret: secret.base32,
        twoFactorEnabled: false,
        twoFactorPendingVerification: true,
        twoFactorBackupCodes: hashedBackupCodes,
        twoFactorSetupStartedAt: new Date()
      });

      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      await SecurityAuditLog.create({
        userId: user.id,
        event: 'TWO_FACTOR_SETUP_INITIATED',
        severity: 'medium',
        details: {
          method: 'TOTP'
        }
      });

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        backupCodes
      };
    } catch (error) {
      logger.error('2FA setup failed:', error);
      throw new Error('Failed to setup 2FA');
    }
  }

  async verifySetup(user, token) {
    try {
      if (!user.twoFactorSecret || !user.twoFactorPendingVerification) {
        throw new Error('2FA setup not initiated');
      }

      // Check if setup session expired (30 minutes)
      if (Date.now() - user.twoFactorSetupStartedAt > 30 * 60 * 1000) {
        await user.update({
          twoFactorSecret: null,
          twoFactorPendingVerification: false,
          twoFactorSetupStartedAt: null
        });
        throw new Error('2FA setup session expired');
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 2 // Allow 2 steps before/after for time drift (±1 minute)
      });

      if (verified) {
        await user.update({
          twoFactorEnabled: true,
          twoFactorPendingVerification: false,
          twoFactorSetupStartedAt: null
        });

        await SecurityAuditLog.create({
          userId: user.id,
          event: 'TWO_FACTOR_ENABLED',
          severity: 'medium',
          details: {
            method: 'TOTP',
            backupCodesGenerated: true
          }
        });
      } else {
        await SecurityAuditLog.create({
          userId: user.id,
          event: 'TWO_FACTOR_SETUP_FAILED',
          severity: 'medium',
          details: {
            reason: 'Invalid verification code'
          }
        });
      }

      return verified;
    } catch (error) {
      logger.error('2FA verification failed:', error);
      throw error;
    }
  }

  async verify(user, token, type = 'totp') {
    try {
      if (!user.twoFactorEnabled) {
        throw new Error('2FA not enabled');
      }

      let verified = false;

      if (type === 'totp') {
        verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token,
          window: 2 // Allow 2 steps before/after for time drift
        });
      } else if (type === 'backup') {
        // Hash provided backup code
        const hashedCode = crypto.createHash('sha256').update(token).digest('hex');
        
        // Check if code exists and remove it if valid
        const backupCodes = user.twoFactorBackupCodes;
        const index = backupCodes.indexOf(hashedCode);
        
        if (index !== -1) {
          verified = true;
          backupCodes.splice(index, 1);
          await user.update({ twoFactorBackupCodes: backupCodes });
          
          // Log backup code usage
          await SecurityAuditLog.create({
            userId: user.id,
            event: 'TWO_FACTOR_BACKUP_CODE_USED',
            severity: 'high',
            details: {
              remainingCodes: backupCodes.length
            }
          });
        }
      }

      // Log verification attempt
      await SecurityAuditLog.create({
        userId: user.id,
        event: verified ? 'TWO_FACTOR_VERIFICATION_SUCCESS' : 'TWO_FACTOR_VERIFICATION_FAILED',
        severity: verified ? 'low' : 'medium',
        details: {
          method: type,
          successful: verified
        }
      });

      return verified;
    } catch (error) {
      logger.error('2FA verification failed:', error);
      throw error;
    }
  }

  async generateNewBackupCodes(user) {
    try {
      const backupCodes = Array.from({length: 10}, () => 
        crypto.randomBytes(4).toString('hex')
      );

      const hashedBackupCodes = backupCodes.map(code => 
        crypto.createHash('sha256').update(code).digest('hex')
      );

      await user.update({ twoFactorBackupCodes: hashedBackupCodes });

      await SecurityAuditLog.create({
        userId: user.id,
        event: 'TWO_FACTOR_BACKUP_CODES_REGENERATED',
        severity: 'high'
      });

      return backupCodes;
    } catch (error) {
      logger.error('Failed to generate new backup codes:', error);
      throw new Error('Failed to generate new backup codes');
    }
  }

  async disable(user, currentPassword) {
    try {
      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        throw new Error('Invalid password');
      }

      if (!user.twoFactorEnabled) {
        throw new Error('2FA is not enabled');
      }

      await user.update({
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: [],
        twoFactorLastVerifiedAt: null
      });

      await SecurityAuditLog.create({
        userId: user.id,
        event: 'TWO_FACTOR_DISABLED',
        severity: 'high',
        details: {
          method: 'TOTP'
        }
      });

      return true;
    } catch (error) {
      logger.error('2FA disable failed:', error);
      throw error;
    }
  }
}

module.exports = new TwoFactorService();
