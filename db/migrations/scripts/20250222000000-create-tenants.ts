import { QueryInterface, DataTypes, Transaction } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface, transaction: Transaction) {
    await queryInterface.createTable('tenants', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      slug: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active'
      },
      settings: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, { transaction });

    await queryInterface.addIndex('tenants', ['slug'], {
      unique: true,
      transaction
    });
  },

  async down(queryInterface: QueryInterface, transaction: Transaction) {
    await queryInterface.dropTable('tenants', { transaction });
  }
};
