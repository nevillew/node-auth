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
    const userAuthenticators = await user.getAuthenticators();

    const options = await generateRegistrationOptions({
      rpName: 'Multi-tenant App',
      rpID,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: userAuthenticators.map(authenticator => ({
        id: authenticator.credentialID,
        type: 'public-key',
        transports: authenticator.transports,
      })),
    });

    // Save challenge for verification
    await user.update({
      currentChallenge: options.challenge
    });

    return options;
  }

  async verifyRegistration(user, response) {
    try {
      const expectedChallenge = user.currentChallenge;
      
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
      });

      const { verified, registrationInfo } = verification;

      if (verified) {
        const { credentialID, credentialPublicKey, counter } = registrationInfo;

        await user.createAuthenticator({
          credentialID: isoBase64URL.toBuffer(credentialID),
          credentialPublicKey: credentialPublicKey,
          counter: counter,
          transports: response.response.transports,
        });

        // Clear challenge
        await user.update({ currentChallenge: null });
      }

      return verified;
    } catch (error) {
      logger.error('Passkey registration verification failed:', error);
      return false;
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
