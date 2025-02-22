const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Authenticator extends Model {
    static associate(models) {
      Authenticator.belongsTo(models.User, {
        foreignKey: 'userId',
        onDelete: 'CASCADE'
      });
    }
  }
  
  Authenticator.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    credentialID: {
      type: DataTypes.BLOB,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: 'Credential ID cannot be empty'
        }
      }
    },
    credentialPublicKey: {
      type: DataTypes.BLOB,
      allowNull: false
    },
    counter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    transports: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    friendlyName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Primary Authenticator',
      validate: {
        notEmpty: {
          msg: 'Friendly name cannot be empty'
        },
        len: {
          args: [1, 50],
          msg: 'Friendly name must be between 1 and 50 characters'
        }
      }
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Authenticator',
  });
  
  return Authenticator;
};
