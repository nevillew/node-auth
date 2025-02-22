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
        throw new AppError('2FA setup already in progress', 400);
      }

      const secret = speakeasy.generateSecret({
        name: `Multi-Tenant App (${user.email})`,
        length: 32 // Increased security
      });

      // Generate backup codes
      const backupCodes = Array.from({length: 10}, () => 
        crypto.randomBytes(4).toString('hex')
      );

      // Hash backup codes before storing
      const hashedBackupCodes = await Promise.all(
        backupCodes.map(code => bcrypt.hash(code, 10))
      );

      // Update user with setup details
      await user.update({
        twoFactorSecret: secret.base32,
        twoFactorBackupCodes: hashedBackupCodes,
        twoFactorPendingVerification: true,
        twoFactorSetupStartedAt: new Date()
      }, { transaction: t });

      // Create security audit log
      await SecurityAuditLog.create({
        userId: user.id,
        event: '2FA_SETUP_STARTED',
        severity: 'medium',
        details: {
          method: 'TOTP'
        }
      }, { transaction: t });

      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      await t.commit();

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        backupCodes // Return plain backup codes only once
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
    const t = await sequelize.transaction();
    try {
      if (!user.twoFactorEnabled) {
        throw new AppError('2FA not enabled', 400);
      }

      let verified = false;
      let verificationDetails = {};

      if (type === 'totp') {
        verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token,
          window: 2 // Allow 2 steps (60 seconds) of time drift
        });

        verificationDetails.method = 'TOTP';
      } else if (type === 'backup') {
        // Verify backup code
        const isBackupCodeValid = await Promise.any(
          user.twoFactorBackupCodes.map(async code => 
            await bcrypt.compare(token, code)
          )
        );

        if (isBackupCodeValid) {
          verified = true;
          // Remove used backup code
          await user.update({
            twoFactorBackupCodes: user.twoFactorBackupCodes.filter(
              (_, index) => !isBackupCodeValid[index]
            )
          }, { transaction: t });

          verificationDetails.method = 'BackupCode';
          verificationDetails.remainingCodes = user.twoFactorBackupCodes.length - 1;
        }
      }

      if (!verified) {
        // Create security audit log for failed attempt
        await SecurityAuditLog.create({
          userId: user.id,
          event: '2FA_VERIFICATION_FAILED',
          severity: 'medium',
          details: {
            type,
            reason: 'Invalid code'
          }
        }, { transaction: t });

        return false;
      }

      // Update last verification time
      await user.update({
        twoFactorLastVerifiedAt: new Date()
      }, { transaction: t });

      // Create security audit log
      await SecurityAuditLog.create({
        userId: user.id,
        event: '2FA_VERIFICATION_SUCCESS',
        severity: 'low',
        details: verificationDetails
      }, { transaction: t });

      await t.commit();
      return true;
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
