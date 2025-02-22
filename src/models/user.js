const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.OAuthToken);
      User.belongsToMany(models.Tenant, {
        through: models.TenantUser,
        foreignKey: 'userId'
      });
    }
  }
  
  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    password: {
      type: DataTypes.STRING,
      validate: {
        isStrongPassword(value) {
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})/.test(value)) {
            throw new Error('Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one special character');
          }
        }
      }
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    accountLockedUntil: DataTypes.DATE,
    name: DataTypes.STRING,
    avatar: DataTypes.STRING,
    googleId: {
      type: DataTypes.STRING,
      unique: true
    },
    twoFactorSecret: DataTypes.STRING,
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    verificationToken: DataTypes.STRING,
    verificationTokenExpires: DataTypes.DATE,
    resetToken: DataTypes.STRING,
    resetTokenExpires: DataTypes.DATE,
    preferences: DataTypes.JSON,
    lastActivity: DataTypes.DATE,
    profile: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'User',
  });
  
  return User;
};
