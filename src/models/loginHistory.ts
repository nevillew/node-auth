import { DataTypes, Model, Sequelize, Optional } from 'sequelize';
import { LoginHistoryAttributes, LoginStatus, GeoLocation, ModelRegistry } from '../types';

/**
 * Interface for LoginHistory creation attributes (with optional fields for creation)
 */
type LoginHistoryCreationAttributes = Optional<
  LoginHistoryAttributes,
  | 'id'
  | 'location'
  | 'details'
  | 'createdAt'
>;

/**
 * Maximum failed login attempts before account is locked
 */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/**
 * Account lock duration in milliseconds (30 minutes)
 */
export const ACCOUNT_LOCK_DURATION_MS = 30 * 60 * 1000;

/**
 * Default location for IP addresses that can't be geolocated
 */
export const DEFAULT_LOCATION: GeoLocation = {
  city: 'Unknown',
  country: 'Unknown'
};

/**
 * Validate IP address format
 */
const isValidIpAddress = (ip: string): boolean => {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (!ipv4Pattern.test(ip)) return false;
  
  // Check that each octet is between 0 and 255
  return ip.split('.').map(Number).every(octet => octet >= 0 && octet <= 255);
};

/**
 * LoginHistory model definition using functional pattern
 */
export const defineLoginHistoryModel = (
  sequelize: Sequelize
): Model<LoginHistoryAttributes, LoginHistoryCreationAttributes> => {
  const LoginHistoryModel = sequelize.define<Model<LoginHistoryAttributes, LoginHistoryCreationAttributes>>(
    'LoginHistory',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      status: {
        type: DataTypes.ENUM(...Object.values(LoginStatus)),
        allowNull: false,
      },
      ip: {
        type: DataTypes.STRING,
        validate: {
          isIP: {
            msg: 'IP address must be valid',
          },
        },
      },
      userAgent: {
        type: DataTypes.STRING(500), // Limit length to prevent overly long user agents
      },
      location: {
        type: DataTypes.JSON,
        defaultValue: DEFAULT_LOCATION,
      },
      details: {
        type: DataTypes.JSON,
        defaultValue: {},
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Tenants',
          key: 'id',
        },
      },
      failureReason: {
        type: DataTypes.STRING,
        allowNull: true,
      }
    },
    {
      sequelize,
      modelName: 'LoginHistory',
      tableName: 'LoginHistories',
      timestamps: true,
      updatedAt: false, // Login history should never be updated
      indexes: [
        {
          fields: ['userId'],
          name: 'login_history_user_idx'
        },
        {
          fields: ['status'],
          name: 'login_history_status_idx'
        },
        {
          fields: ['createdAt'],
          name: 'login_history_date_idx'
        },
        {
          fields: ['tenantId'],
          name: 'login_history_tenant_idx'
        },
        {
          fields: ['ip'],
          name: 'login_history_ip_idx'
        }
      ]
    }
  );

  // Define model associations using a typed approach
  const associateLoginHistory = (models: ModelRegistry): void => {
    LoginHistoryModel.belongsTo(models.User, {
      foreignKey: 'userId',
      onDelete: 'CASCADE',
    });
    
    LoginHistoryModel.belongsTo(models.Tenant, {
      foreignKey: 'tenantId',
    });
  };

  // Static methods
  (LoginHistoryModel as any).recordLogin = async (
    data: LoginHistoryCreationAttributes
  ): Promise<Model<LoginHistoryAttributes>> => {
    return LoginHistoryModel.create(data);
  };
  
  (LoginHistoryModel as any).getRecentLogins = async (
    userId: string, 
    limit = 10
  ): Promise<Model<LoginHistoryAttributes>[]> => {
    return LoginHistoryModel.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit
    });
  };
  
  (LoginHistoryModel as any).getFailedLoginCount = async (
    userId: string, 
    sinceTime: Date
  ): Promise<number> => {
    const count = await LoginHistoryModel.count({
      where: { 
        userId, 
        status: LoginStatus.FAILED,
        createdAt: {
          [DataTypes.Op.gte]: sinceTime
        }
      }
    });
    return count;
  };
  
  (LoginHistoryModel as any).getUserLastLogin = async (
    userId: string
  ): Promise<Model<LoginHistoryAttributes>> => {
    return LoginHistoryModel.findOne({
      where: { 
        userId,
        status: LoginStatus.SUCCESS
      },
      order: [['createdAt', 'DESC']]
    });
  };

  (LoginHistoryModel as any).getSuccessfulLoginsByIp = async (
    ip: string,
    limit = 10
  ): Promise<Model<LoginHistoryAttributes>[]> => {
    return LoginHistoryModel.findAll({
      where: { 
        ip,
        status: LoginStatus.SUCCESS
      },
      order: [['createdAt', 'DESC']],
      limit
    });
  };

  // Add association method to model
  (LoginHistoryModel as any).associate = associateLoginHistory;

  return LoginHistoryModel;
};

export default defineLoginHistoryModel;