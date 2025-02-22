const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    static associate(models) {
      Role.belongsTo(models.Tenant);
      Role.belongsToMany(models.User, {
        through: models.UserRole
      });
      Role.belongsToMany(models.Permission, {
        through: models.RolePermission
      });
    }
  }
  
  Role.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.TEXT,
    scopes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      validate: {
        isValidScopes(value) {
          const validScopes = ['read', 'write', 'delete', 'admin'];
          if (value.some(scope => !validScopes.includes(scope))) {
            throw new Error('Invalid scope provided');
          }
        }
      }
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Tenants',
        key: 'id'
      }
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Role',
  });
  
  return Role;
};
