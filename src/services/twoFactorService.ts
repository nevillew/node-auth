import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { User, SecurityAuditLog, sequelize } from '../models';
import { UserAttributes } from '../types';
import { Result, success, failure } from '../utils/errors';
import logger from '../config/logger';
import { Transaction } from 'sequelize';

// Types for two-factor service
interface TwoFactorSecretResult {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  expiresAt: Date;
}

interface VerifyOptions {
  user: UserAttributes & {
    increment: (field: string, options?: { transaction?: Transaction }) => Promise<any>;
    update: (data: Partial<UserAttributes>, options?: { transaction?: Transaction }) => Promise<any>;
  };
  token: string;
  type?: 'totp' | 'backup';
}

/**
 * Generate a two-factor secret for a user
 */
export const generateSecret = async (
  user: UserAttributes & {
    update: (data: Partial<UserAttributes>, options?: { transaction?: Transaction }) => Promise<any>;
  }
): Promise<Result<TwoFactorSecretResult>> => {
  const t = await sequelize.transaction();
  
  try {
    // Check if 2FA is already pending verification
    if (user.twoFactorPendingVerification) {
      await t.rollback();
      return failure({
        message: '2FA setup already in progress. Please complete the pending verification or cancel it first.',
        statusCode: 400
      });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      await t.rollback();
      return failure({
        message: '2FA is already enabled for this account',
        statusCode: 400
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Multi-Tenant App (${user.email})`,
      length: 32, // Increased security
      issuer: process.env.APP_NAME || 'Multi-Tenant App'
    });

    // Generate backup codes with proper formatting
    const backupCodes = Array.from({length: 10}, () => {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      return code.match(/.{1,4}/g)?.join('-') || code; // Format as XXXX-XXXX
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
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '', {
      errorCorrectionLevel: 'H', // High error correction
      type: 'image/png',
      margin: 2,
      width: 300
    });

    await t.commit();

    return success({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      backupCodes, // Return plain backup codes only once
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes to complete setup
    });
  } catch (err) {
    await t.rollback();
    logger.error('2FA setup failed:', { 
      userId: user.id,
      error: err
    });
    
    return failure({
      message: 'Failed to setup 2FA. Please try again.',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Verify the setup of two-factor authentication
 */
export const verifySetup = async (
  user: UserAttributes & {
    update: (data: Partial<UserAttributes>, options?: { transaction?: Transaction }) => Promise<any>;
    increment: (field: string, options?: { transaction?: Transaction }) => Promise<any>;
  },
  token: string
): Promise<Result<boolean>> => {
  const t = await sequelize.transaction();
  
  try {
    if (!user.twoFactorSecret || !user.twoFactorPendingVerification) {
      await t.rollback();
      return failure({
        message: '2FA setup not initiated. Please start the 2FA setup process first.',
        statusCode: 400
      });
    }

    // Check if setup session expired (10 minutes)
    if (user.twoFactorSetupStartedAt && 
        Date.now() - new Date(user.twoFactorSetupStartedAt).getTime() > 10 * 60 * 1000) {
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

      await t.commit();
      return failure({
        message: '2FA setup session expired. Please start the setup process again.',
        statusCode: 400
      });
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

      await t.commit();
      return failure({
        message: 'Too many failed attempts. 2FA setup has been locked. Please try again later.',
        statusCode: 429
      });
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

      await t.commit();
      return failure({
        message: 'Invalid verification code. Please try again.',
        statusCode: 400
      });
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
    return success(true);
  } catch (err) {
    await t.rollback();
    logger.error('2FA verification failed:', {
      userId: user.id,
      error: err
    });
    
    return failure({
      message: 'Failed to verify 2FA setup.',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Verify a two-factor token
 */
export const verify = async (
  options: VerifyOptions
): Promise<Result<boolean>> => {
  const { user, token, type = 'totp' } = options;
  const t = await sequelize.transaction();
  
  try {
    if (!user.twoFactorEnabled) {
      await t.rollback();
      return failure({
        message: '2FA is not enabled for this account',
        statusCode: 400
      });
    }

    // Check if verification is locked due to too many attempts
    if (user.twoFactorVerificationAttempts >= 5 && user.twoFactorLastFailedAttempt) {
      const lockDuration = 15 * 60 * 1000; // 15 minutes
      const unlockTime = new Date(new Date(user.twoFactorLastFailedAttempt).getTime() + lockDuration);
      
      if (Date.now() < unlockTime.getTime()) {
        await SecurityAuditLog.create({
          userId: user.id,
          event: '2FA_VERIFICATION_LOCKED',
          severity: 'high',
          details: {
            unlockTime: unlockTime.toISOString()
          }
        }, { transaction: t });

        await t.commit();
        return failure({
          message: `Too many failed attempts. 2FA verification is locked until ${unlockTime.toLocaleTimeString()}`,
          statusCode: 429
        });
      }
    }

    let verified = false;
    const verificationDetails: Record<string, any> = {};

    if (type === 'totp' && user.twoFactorSecret) {
      verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 4 // Allow 4 steps (2 minutes) for time drift
      });

      verificationDetails.method = 'TOTP';
    } else if (type === 'backup' && user.twoFactorBackupCodes) {
      // Verify backup code
      let backupCodeIndex: number | null = null;
      
      for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
        try {
          const isValid = await bcrypt.compare(token, user.twoFactorBackupCodes[i]);
          if (isValid) {
            backupCodeIndex = i;
            break;
          }
        } catch (err) {
          logger.error('Error comparing backup code:', { error: err });
        }
      }
      
      if (backupCodeIndex !== null) {
        verified = true;
        // Remove used backup code
        const updatedCodes = user.twoFactorBackupCodes.filter(
          (_, index) => index !== backupCodeIndex
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
        twoFactorVerificationAttempts: user.twoFactorVerificationAttempts + 1,
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

      await t.commit();
      return failure({
        message: 'Invalid verification code',
        statusCode: 400
      });
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
    return success(true);
  } catch (err) {
    await t.rollback();
    logger.error('2FA verification failed:', {
      userId: user.id,
      type,
      error: err
    });
    
    return failure({
      message: 'Failed to verify 2FA token.',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Generate new backup codes for a user
 */
export const generateNewBackupCodes = async (
  user: UserAttributes & {
    update: (data: Partial<UserAttributes>) => Promise<any>;
  }
): Promise<Result<string[]>> => {
  try {
    const backupCodes = Array.from({length: 10}, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
        .match(/.{1,4}/g)?.join('-') || ''
    );

    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 12))
    );

    await user.update({ twoFactorBackupCodes: hashedBackupCodes });

    await SecurityAuditLog.create({
      userId: user.id,
      event: 'TWO_FACTOR_BACKUP_CODES_REGENERATED',
      severity: 'high'
    });

    return success(backupCodes);
  } catch (err) {
    logger.error('Failed to generate new backup codes:', { error: err });
    return failure({
      message: 'Failed to generate new backup codes',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Disable two-factor authentication for a user
 */
export const disable = async (
  user: UserAttributes & {
    update: (data: Partial<UserAttributes>) => Promise<any>;
  },
  currentPassword: string
): Promise<Result<boolean>> => {
  try {
    // Verify current password
    if (!user.password) {
      return failure({
        message: 'User password not available',
        statusCode: 400
      });
    }
    
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return failure({
        message: 'Invalid password',
        statusCode: 401
      });
    }

    if (!user.twoFactorEnabled) {
      return failure({
        message: '2FA is not enabled',
        statusCode: 400
      });
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

    return success(true);
  } catch (err) {
    logger.error('2FA disable failed:', { error: err });
    return failure({
      message: 'Failed to disable 2FA',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};