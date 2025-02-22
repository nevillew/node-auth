const { 
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = require('@simplewebauthn/server');
const { isoBase64URL } = require('@simplewebauthn/server/helpers');
const { User } = require('../models');
const logger = require('../config/logger');

// Expected origin depends on your environment
const rpID = process.env.RP_ID || 'localhost';
const expectedOrigin = process.env.ORIGIN || `https://${rpID}`;

class PassKeyService {
  async generateRegistrationOptions(user) {
    try {
      // Validate user
      if (!user || !user.id) {
        throw new Error('Invalid user');
      }

      // Get existing authenticators
      const userAuthenticators = await user.getAuthenticators();
      
      // Validate maximum number of authenticators
      const maxAuthenticators = process.env.MAX_AUTHENTICATORS || 5;
      if (userAuthenticators.length >= maxAuthenticators) {
        throw new Error(`Maximum of ${maxAuthenticators} authenticators allowed`);
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
        challenge: crypto.randomBytes(32) // Strong random challenge
      });

      // Validate generated options
      if (!options.challenge || !options.user.id) {
        throw new Error('Failed to generate valid registration options');
      }

      // Save challenge for verification
      await user.update({
        currentChallenge: options.challenge,
        passkeyRegistrationStartedAt: new Date()
      });

      return options;
    } catch (error) {
      logger.error('Failed to generate registration options:', error);
      throw new Error('Failed to start passkey registration');
    }
  }

  async verifyRegistration(user, response) {
    const t = await sequelize.transaction();
    try {
      // Validate input
      if (!user || !response) {
        throw new Error('Invalid input parameters');
      }

      // Validate registration time window
      const registrationStart = user.passkeyRegistrationStartedAt;
      if (!registrationStart || (new Date() - registrationStart) > 120000) { // 2 minutes
        throw new Error('Registration session expired');
      }

      const expectedChallenge = user.currentChallenge;
      if (!expectedChallenge) {
        throw new Error('No registration challenge found');
      }

      // Validate response structure
      if (!response.id || !response.rawId || !response.response) {
        throw new Error('Invalid registration response');
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
        throw new Error('Registration verification failed');
      }

      const { credentialID, credentialPublicKey, counter } = registrationInfo;

      // Validate credential ID
      if (!credentialID || credentialID.length === 0) {
        throw new Error('Invalid credential ID');
      }

      // Check if credential already exists
      const existingAuth = await Authenticator.findOne({
        where: { credentialID: isoBase64URL.toBuffer(credentialID) },
        transaction: t
      });

      if (existingAuth) {
        throw new Error('Credential already registered');
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
      return verified;
    } catch (error) {
      await t.rollback();
      logger.error('Passkey registration verification failed:', error);
      
      // Create failed attempt audit log
      await SecurityAuditLog.create({
        userId: user.id,
        event: 'PASSKEY_REGISTRATION_FAILED',
        details: {
          error: error.message
        },
        severity: 'high'
      });

      throw new Error('Passkey registration failed: ' + error.message);
    }
  }

  async generateAuthenticationOptions(user) {
    const userAuthenticators = await user.getAuthenticators();

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

    return options;
  }

  async verifyAuthentication(user, response) {
    try {
      const authenticator = await user.getAuthenticators({
        where: {
          credentialID: isoBase64URL.toBuffer(response.id)
        }
      });

      if (!authenticator) {
        throw new Error('Authenticator not found');
      }

      const expectedChallenge = user.currentChallenge;

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
        // Update counter
        await authenticator.update({
          counter: authenticationInfo.newCounter
        });

        // Clear challenge
        await user.update({ currentChallenge: null });
      }

      return verified;
    } catch (error) {
      logger.error('Passkey authentication verification failed:', error);
      return false;
    }
  }
}

module.exports = new PassKeyService();
