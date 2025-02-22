'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('RolePermissions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      roleId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Roles',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      permissionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Permissions',
          key: 'id'
        },
        onDelete: 'CASCADE'
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

    await queryInterface.addIndex('RolePermissions', ['roleId']);
    await queryInterface.addIndex('RolePermissions', ['permissionId']);
    await queryInterface.addConstraint('RolePermissions', {
      fields: ['roleId', 'permissionId'],
      type: 'unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('RolePermissions');
  }
};
