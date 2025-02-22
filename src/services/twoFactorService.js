const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { User, SecurityAuditLog } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');
const sequelize = require('../config/database').sequelize;

class TwoFactorService {
  async generateSecret(user) {
    const t = await sequelize.transaction();
    try {
      // Check if 2FA is already pending verification
      if (user.twoFactorPendingVerification) {
        throw new AppError('2FA setup already in progress. Please complete the pending verification or cancel it first.', 400);
      }

      // Check if 2FA is already enabled
      if (user.twoFactorEnabled) {
        throw new AppError('2FA is already enabled for this account', 400);
      }

      const secret = speakeasy.generateSecret({
        name: `Multi-Tenant App (${user.email})`,
        length: 32, // Increased security
        issuer: process.env.APP_NAME || 'Multi-Tenant App'
      });

      // Generate backup codes with proper formatting
      const backupCodes = Array.from({length: 10}, () => {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        return code.match(/.{1,4}/g).join('-'); // Format as XXXX-XXXX
      });

      // Hash backup codes before storing
      const hashedBackupCodes = await Promise.all(
        backupCodes.map(code => bcrypt.hash(code, 12))
      );

      // Update user with setup details
      await user.update({
        twoFactorSecret: secret.base32,
        twoFactorBackupCodes: hashedBackupCodes,
        twoFactorPendingVerification: true,
        twoFactorSetupStartedAt: new Date(),
        twoFactorVerificationAttempts: 0
      }, { transaction: t });

      // Create security audit log
      await SecurityAuditLog.create({
        userId: user.id,
        event: '2FA_SETUP_STARTED',
        severity: 'medium',
        details: {
          method: 'TOTP',
          backupCodesGenerated: true
        }
      }, { transaction: t });

      // Generate QR code with error correction
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url, {
        errorCorrectionLevel: 'H', // High error correction
        type: 'image/png',
        margin: 2,
        width: 300
      });

      await t.commit();

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        backupCodes, // Return plain backup codes only once
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes to complete setup
      };
    } catch (error) {
      await t.rollback();
      logger.error('2FA setup failed:', { 
        userId: user.id,
        error: error.message,
        stack: error.stack 
      });
      throw new AppError('Failed to setup 2FA. Please try again.', 500);
    }
  }

  async verifySetup(user, token) {
    const t = await sequelize.transaction();
    try {
      if (!user.twoFactorSecret || !user.twoFactorPendingVerification) {
        throw new AppError('2FA setup not initiated. Please start the 2FA setup process first.', 400);
      }

      // Check if setup session expired (10 minutes)
      if (Date.now() - user.twoFactorSetupStartedAt > 10 * 60 * 1000) {
        await user.update({
          twoFactorSecret: null,
          twoFactorPendingVerification: false,
          twoFactorSetupStartedAt: null,
          twoFactorBackupCodes: []
        }, { transaction: t });

        await SecurityAuditLog.create({
          userId: user.id,
          event: '2FA_SETUP_EXPIRED',
          severity: 'medium',
          details: {
            reason: 'Setup session expired'
          }
        }, { transaction: t });

        throw new AppError('2FA setup session expired. Please start the setup process again.', 400);
      }

      // Check verification attempts
      if (user.twoFactorVerificationAttempts >= 5) {
        await SecurityAuditLog.create({
          userId: user.id,
          event: '2FA_SETUP_LOCKED',
          severity: 'high',
          details: {
            reason: 'Too many failed verification attempts'
          }
        }, { transaction: t });

        throw new AppError('Too many failed attempts. 2FA setup has been locked. Please try again later.', 429);
      }

      // Verify token with wider time window
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 4 // Allow 4 steps (2 minutes) for time drift
      });

      if (!verified) {
        // Increment failed attempts
        await user.increment('twoFactorVerificationAttempts', { transaction: t });

        await SecurityAuditLog.create({
          userId: user.id,
          event: '2FA_SETUP_FAILED',
          severity: 'medium',
          details: {
            reason: 'Invalid verification code',
            attempts: user.twoFactorVerificationAttempts + 1
          }
        }, { transaction: t });

        throw new AppError('Invalid verification code. Please try again.', 400);
      }

      // Successful verification
      await user.update({
        twoFactorEnabled: true,
        twoFactorPendingVerification: false,
        twoFactorSetupStartedAt: null,
        twoFactorVerificationAttempts: 0,
        twoFactorLastVerifiedAt: new Date()
      }, { transaction: t });

      await SecurityAuditLog.create({
        userId: user.id,
        event: '2FA_ENABLED',
        severity: 'medium',
        details: {
          method: 'TOTP',
          backupCodesGenerated: true
        }
      }, { transaction: t });

      // Log backup codes usage
      await SecurityAuditLog.create({
        userId: user.id,
        event: '2FA_BACKUP_CODES_GENERATED',
        severity: 'medium',
        details: {
          count: 10,
          codesRemaining: 10
        }
      }, { transaction: t });

      await t.commit();
      return true;
    } catch (error) {
      await t.rollback();
      logger.error('2FA verification failed:', {
        userId: user.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async verify(user, token, type = 'totp') {
    const t = await sequelize.transaction();
    try {
      if (!user.twoFactorEnabled) {
        throw new AppError('2FA is not enabled for this account', 400);
      }

      // Check if verification is locked due to too many attempts
      if (user.twoFactorVerificationAttempts >= 5) {
        const lockDuration = 15 * 60 * 1000; // 15 minutes
        const unlockTime = new Date(user.twoFactorLastFailedAttempt + lockDuration);
        
        if (Date.now() < unlockTime) {
          await SecurityAuditLog.create({
            userId: user.id,
            event: '2FA_VERIFICATION_LOCKED',
            severity: 'high',
            details: {
              unlockTime: unlockTime.toISOString()
            }
          }, { transaction: t });

          throw new AppError(
            `Too many failed attempts. 2FA verification is locked until ${unlockTime.toLocaleTimeString()}`,
            429
          );
        }
      }

      let verified = false;
      let verificationDetails = {};

      if (type === 'totp') {
        verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token,
          window: 4 // Allow 4 steps (2 minutes) for time drift
        });

        verificationDetails.method = 'TOTP';
      } else if (type === 'backup') {
        // Verify backup code
        const isBackupCodeValid = await Promise.any(
          user.twoFactorBackupCodes.map(async (code, index) => {
            const isValid = await bcrypt.compare(token, code);
            return isValid ? index : null;
          })
        );

        if (isBackupCodeValid !== null) {
          verified = true;
          // Remove used backup code
          const updatedCodes = user.twoFactorBackupCodes.filter(
            (_, index) => index !== isBackupCodeValid
          );

          await user.update({
            twoFactorBackupCodes: updatedCodes
          }, { transaction: t });

          verificationDetails.method = 'BackupCode';
          verificationDetails.remainingCodes = updatedCodes.length;

          // Log backup code usage
          await SecurityAuditLog.create({
            userId: user.id,
            event: '2FA_BACKUP_CODE_USED',
            severity: 'medium',
            details: {
              codesRemaining: updatedCodes.length
            }
          }, { transaction: t });
        }
      }

      if (!verified) {
        // Increment failed attempts
        await user.update({
          twoFactorVerificationAttempts: sequelize.literal('twoFactorVerificationAttempts + 1'),
          twoFactorLastFailedAttempt: new Date()
        }, { transaction: t });

        await SecurityAuditLog.create({
          userId: user.id,
          event: '2FA_VERIFICATION_FAILED',
          severity: 'medium',
          details: {
            type,
            reason: 'Invalid code',
            attempts: user.twoFactorVerificationAttempts + 1
          }
        }, { transaction: t });

        throw new AppError('Invalid verification code', 400);
      }

      // Successful verification
      await user.update({
        twoFactorLastVerifiedAt: new Date(),
        twoFactorVerificationAttempts: 0,
        twoFactorLastFailedAttempt: null
      }, { transaction: t });

      await SecurityAuditLog.create({
        userId: user.id,
        event: '2FA_VERIFICATION_SUCCESS',
        severity: 'low',
        details: verificationDetails
      }, { transaction: t });

      await t.commit();
      return true;
    } catch (error) {
      await t.rollback();
      logger.error('2FA verification failed:', {
        userId: user.id,
        type,
        error: error.message,
        stack: error.stack
      });
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
