'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      password: Sequelize.STRING,
      name: Sequelize.STRING,
      avatar: Sequelize.STRING,
      googleId: {
        type: Sequelize.STRING,
        unique: true
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

    await queryInterface.createTable('Tenants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      slug: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      databaseUrl: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      logo: Sequelize.STRING,
      colors: Sequelize.JSON,
      features: Sequelize.JSON,
      securityPolicy: Sequelize.JSON,
      status: {
        type: Sequelize.STRING,
        defaultValue: 'active'
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

    await queryInterface.createTable('TenantUsers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      tenantId: {
        type: Sequelize.UUID,
        references: {
          model: 'Tenants',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      roles: {
        type: Sequelize.ARRAY(Sequelize.STRING)
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

    await queryInterface.addConstraint('TenantUsers', {
      fields: ['userId', 'tenantId'],
      type: 'unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('TenantUsers');
    await queryInterface.dropTable('Tenants');
    await queryInterface.dropTable('Users');
  }
};
