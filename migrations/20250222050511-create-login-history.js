'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
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

    await queryInterface.addIndex('LoginHistories', ['userId']);
    await queryInterface.addIndex('LoginHistories', ['status']);
    await queryInterface.addIndex('LoginHistories', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('LoginHistories');
  }
};
