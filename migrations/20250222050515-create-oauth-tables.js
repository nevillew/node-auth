'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create OAuth Clients table
    await queryInterface.createTable('OAuthClients', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      clientId: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      clientSecret: {
        type: Sequelize.STRING,
        allowNull: false
      },
      grants: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      redirectUris: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Create OAuth Tokens table
    await queryInterface.createTable('OAuthTokens', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      accessToken: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      accessTokenExpiresAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      refreshToken: {
        type: Sequelize.STRING,
        unique: true
      },
      refreshTokenExpiresAt: Sequelize.DATE,
      clientId: {
        type: Sequelize.UUID,
        references: {
          model: 'OAuthClients',
          key: 'id'
        }
      },
      userId: {
        type: Sequelize.UUID,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      revoked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('OAuthTokens', ['accessToken']);
    await queryInterface.addIndex('OAuthTokens', ['refreshToken']);
    await queryInterface.addIndex('OAuthTokens', ['userId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('OAuthTokens');
    await queryInterface.dropTable('OAuthClients');
  }
};
