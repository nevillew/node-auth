'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns to Users table
    await queryInterface.addColumn('Users', 'lastFailedLoginAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('Users', 'currentChallenge', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('Users', 'passKeyEnabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    // Create Authenticators table
    await queryInterface.createTable('Authenticators', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      credentialID: {
        type: Sequelize.BLOB,
        allowNull: false,
        unique: true
      },
      credentialPublicKey: {
        type: Sequelize.BLOB,
        allowNull: false
      },
      counter: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      transports: {
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'lastFailedLoginAt');
    await queryInterface.removeColumn('Users', 'currentChallenge');
    await queryInterface.removeColumn('Users', 'passKeyEnabled');
    await queryInterface.dropTable('Authenticators');
  }
};
