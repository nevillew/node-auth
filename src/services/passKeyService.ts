import { 
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import crypto from 'crypto';
import { Result, success, failure } from '../utils/errors';
import logger from '../config/logger';
import { User, Authenticator, SecurityAuditLog, sequelize } from '../models';

// We'll need to convert the redis client to TypeScript later
// For now, use require for compatibility
const { redisClient } = require('../config/redis');

// Types for passkey service
interface PassKeyUser {
  id: string;
  email: string;
  name: string;
  currentChallenge?: string;
  passkeyRegistrationStartedAt?: Date;
  passKeyEnabled?: boolean;
  update: (data: any, options?: any) => Promise<any>;
  getAuthenticators: (options?: any) => Promise<any>;
  createAuthenticator: (data: any, options?: any) => Promise<any>;
}

interface AuthenticatorDevice {
  id: string;
  credentialID: Buffer;
  credentialPublicKey: Buffer;
  counter: number;
  transports?: string[];
  lastUsedAt: Date;
  friendlyName?: string;
  update: (data: any, options?: any) => Promise<any>;
}

interface RegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: string;
    alg: number;
  }>;
  timeout: number;
  attestation: string;
  excludeCredentials: Array<{
    id: Buffer;
    type: string;
    transports?: string[];
  }>;
  authenticatorSelection: {
    authenticatorAttachment?: string;
    requireResidentKey: boolean;
    residentKey: string;
    userVerification: string;
  };
}

interface AuthenticationOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials: Array<{
    id: Buffer;
    type: string;
    transports?: string[];
  }>;
  userVerification: string;
}

interface RegistrationResponse {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
  };
  type: string;
  clientExtensionResults?: Record<string, any>;
  friendlyName?: string;
}

interface AuthenticationResponse {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
  type: string;
  clientExtensionResults?: Record<string, any>;
}

// Expected origin depends on your environment
const rpID = process.env.RP_ID || 'localhost';
const expectedOrigin = process.env.ORIGIN || `https://${rpID}`;

/**
 * Generate passkey registration options
 */
export const generatePasskeyRegistrationOptions = async (
  user: PassKeyUser
): Promise<Result<RegistrationOptions>> => {
  try {
    // Check rate limit
    const rateLimitKey = `passkey-registration:${user.id}`;
    const attempts = await redisClient.incr(rateLimitKey);
    
    if (attempts === 1) {
      await redisClient.expire(rateLimitKey, 3600); // 1 hour window
    }
    
    if (attempts > 3) {
      return failure({
        message: 'Too many registration attempts. Please try again later.',
        statusCode: 429
      });
    }

    // Validate user
    if (!user || !user.id) {
      return failure({
        message: 'Invalid user',
        statusCode: 400
      });
    }

    // Get existing authenticators
    const userAuthenticators = await user.getAuthenticators();
    
    // Validate maximum number of authenticators
    const maxAuthenticators = parseInt(process.env.MAX_AUTHENTICATORS || '5', 10);
    if (userAuthenticators.length >= maxAuthenticators) {
      return failure({
        message: `Maximum of ${maxAuthenticators} authenticators allowed`,
        statusCode: 400
      });
    }

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: process.env.RP_NAME || 'Multi-tenant App',
      rpID,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
        requireResidentKey: true
      },
      excludeCredentials: userAuthenticators.map(authenticator => ({
        id: authenticator.credentialID,
        type: 'public-key',
        transports: authenticator.transports,
      })),
      timeout: 60000, // 1 minute
      challenge: crypto.randomBytes(32).toString('base64url') // Strong random challenge
    });

    // Validate generated options
    if (!options.challenge || !options.user.id) {
      return failure({
        message: 'Failed to generate valid registration options',
        statusCode: 500
      });
    }

    // Save challenge for verification
    await user.update({
      currentChallenge: options.challenge,
      passkeyRegistrationStartedAt: new Date()
    });

    return success(options);
  } catch (err) {
    logger.error('Failed to generate registration options:', { error: err });
    return failure({
      message: 'Failed to start passkey registration',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Verify passkey registration response
 */
export const verifyPasskeyRegistration = async (
  user: PassKeyUser,
  response: RegistrationResponse
): Promise<Result<boolean>> => {
  const t = await sequelize.transaction();
  
  try {
    // Validate input
    if (!user || !response) {
      await t.rollback();
      return failure({
        message: 'Invalid input parameters',
        statusCode: 400
      });
    }

    // Validate registration time window
    const registrationStart = user.passkeyRegistrationStartedAt;
    if (!registrationStart || (new Date().getTime() - registrationStart.getTime()) > 120000) { // 2 minutes
      await t.rollback();
      return failure({
        message: 'Registration session expired',
        statusCode: 400
      });
    }

    const expectedChallenge = user.currentChallenge;
    if (!expectedChallenge) {
      await t.rollback();
      return failure({
        message: 'No registration challenge found',
        statusCode: 400
      });
    }

    // Validate response structure
    if (!response.id || !response.rawId || !response.response) {
      await t.rollback();
      return failure({
        message: 'Invalid registration response',
        statusCode: 400
      });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true
    });

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      await t.rollback();
      return failure({
        message: 'Registration verification failed',
        statusCode: 400
      });
    }

    const { credentialID, credentialPublicKey, counter } = registrationInfo;

    // Validate credential ID
    if (!credentialID || credentialID.byteLength === 0) {
      await t.rollback();
      return failure({
        message: 'Invalid credential ID',
        statusCode: 400
      });
    }

    // Check if credential already exists
    const existingAuth = await Authenticator.findOne({
      where: { credentialID: isoBase64URL.toBuffer(credentialID) },
      transaction: t
    });

    if (existingAuth) {
      await t.rollback();
      return failure({
        message: 'Credential already registered',
        statusCode: 409
      });
    }

    // Create new authenticator
    await user.createAuthenticator({
      credentialID: isoBase64URL.toBuffer(credentialID),
      credentialPublicKey: credentialPublicKey,
      counter: counter,
      transports: response.response.transports || [],
      lastUsedAt: new Date(),
      friendlyName: response.friendlyName || 'Primary Authenticator'
    }, { transaction: t });

    // Clear registration state
    await user.update({ 
      currentChallenge: null,
      passkeyRegistrationStartedAt: null,
      passKeyEnabled: true 
    }, { transaction: t });

    // Create security audit log
    await SecurityAuditLog.create({
      userId: user.id,
      event: 'PASSKEY_REGISTERED',
      details: {
        authenticator: {
          aaguid: registrationInfo.aaguid,
          credentialType: registrationInfo.credentialType,
          attestationType: registrationInfo.attestationType
        }
      },
      severity: 'medium'
    }, { transaction: t });

    await t.commit();
    return success(true);
  } catch (err) {
    await t.rollback();
    logger.error('Passkey registration verification failed:', { error: err });
    
    // Create failed attempt audit log
    try {
      await SecurityAuditLog.create({
        userId: user.id,
        event: 'PASSKEY_REGISTRATION_FAILED',
        details: {
          error: err instanceof Error ? err.message : 'Unknown error',
          attempts: await redisClient.incr(`passkey-registration-attempts:${user.id}`)
        },
        severity: 'high'
      });

      // Set TTL for attempts counter if not exists
      await redisClient.expire(`passkey-registration-attempts:${user.id}`, 3600); // 1 hour
    } catch (logError) {
      logger.error('Failed to create audit log for passkey failure', { error: logError });
    }

    return failure({
      message: 'Passkey registration failed',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Generate passkey authentication options
 */
export const generatePasskeyAuthenticationOptions = async (
  user: PassKeyUser
): Promise<Result<AuthenticationOptions>> => {
  try {
    const userAuthenticators = await user.getAuthenticators();
    
    if (!userAuthenticators || userAuthenticators.length === 0) {
      return failure({
        message: 'No authenticators found for this user',
        statusCode: 400
      });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userAuthenticators.map(authenticator => ({
        id: authenticator.credentialID,
        type: 'public-key',
        transports: authenticator.transports,
      })),
      userVerification: 'preferred',
    });

    // Save challenge for verification
    await user.update({
      currentChallenge: options.challenge
    });

    return success(options);
  } catch (err) {
    logger.error('Failed to generate authentication options:', { error: err });
    return failure({
      message: 'Failed to start authentication',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Verify passkey authentication response
 */
export const verifyPasskeyAuthentication = async (
  user: PassKeyUser,
  response: AuthenticationResponse
): Promise<Result<boolean>> => {
  const t = await sequelize.transaction();
  
  try {
    const authenticators = await user.getAuthenticators({
      where: {
        credentialID: isoBase64URL.toBuffer(response.id)
      },
      transaction: t
    });

    const authenticator = authenticators[0];
    
    if (!authenticator) {
      await t.rollback();
      return failure({
        message: 'Authenticator not found',
        statusCode: 404
      });
    }

    const expectedChallenge = user.currentChallenge;
    if (!expectedChallenge) {
      await t.rollback();
      return failure({
        message: 'No authentication challenge found',
        statusCode: 400
      });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: authenticator.credentialID,
        credentialPublicKey: authenticator.credentialPublicKey,
        counter: authenticator.counter,
      },
    });

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // Update counter and last used timestamp
      await authenticator.update({
        counter: authenticationInfo.newCounter,
        lastUsedAt: new Date()
      }, { transaction: t });

      // Clear challenge
      await user.update({ currentChallenge: null }, { transaction: t });

      // Create security audit log
      await SecurityAuditLog.create({
        userId: user.id,
        event: 'PASSKEY_AUTHENTICATION',
        details: {
          authenticatorId: authenticator.id,
          friendlyName: authenticator.friendlyName
        },
        severity: 'low'
      }, { transaction: t });

      await t.commit();
      return success(true);
    } else {
      await t.rollback();
      return failure({
        message: 'Authentication verification failed',
        statusCode: 401
      });
    }
  } catch (err) {
    await t.rollback();
    logger.error('Passkey authentication verification failed:', { error: err });
    return failure({
      message: 'Authentication verification failed',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};