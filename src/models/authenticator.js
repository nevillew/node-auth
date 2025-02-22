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
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Authenticator',
  });
  
  return Authenticator;
};
