'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create LoginHistory table
    await queryInterface.createTable('LoginHistories', {
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
      ipAddress: Sequelize.STRING,
      userAgent: Sequelize.STRING,
      location: Sequelize.JSON,
      status: {
        type: Sequelize.ENUM('success', 'failed'),
        allowNull: false
      },
      failureReason: Sequelize.STRING,
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Create ActivityLog table
    await queryInterface.createTable('ActivityLogs', {
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
      action: {
        type: Sequelize.STRING,
        allowNull: false
      },
      details: Sequelize.JSON,
      ipAddress: Sequelize.STRING,
      userAgent: Sequelize.STRING,
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add new columns to Users table
    await queryInterface.addColumn('Users', 'preferences', {
      type: Sequelize.JSON,
      defaultValue: {
        theme: 'light',
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        accessibility: {
          highContrast: false,
          fontSize: 'normal'
        },
        privacy: {
          profileVisibility: 'public',
          activityVisibility: 'private'
        }
      }
    });

    await queryInterface.addColumn('Users', 'emailPreferences', {
      type: Sequelize.JSON,
      defaultValue: {
        marketing: true,
        updates: true,
        security: true,
        newsletter: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('LoginHistories');
    await queryInterface.dropTable('ActivityLogs');
    await queryInterface.removeColumn('Users', 'preferences');
    await queryInterface.removeColumn('Users', 'emailPreferences');
  }
};
