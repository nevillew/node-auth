import { DataTypes, Model, Sequelize, Optional } from 'sequelize';
import { 
  TenantAttributes, 
  TenantStatus,
  TenantSecurityPolicy,
  PasswordPolicy,
  SessionPolicy,
  IpRestrictionPolicy,
  ModelRegistry,
  AssociableModel
} from '../types';

/**
 * Interface for Tenant creation attributes (with optional fields for creation)
 */
type TenantCreationAttributes = Optional<
  TenantAttributes,
  | 'id'
  | 'status'
  | 'features'
  | 'securityPolicy'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * Default security policy values
 */
const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventPasswordReuse: 5,
  expiryDays: 90,
};

const DEFAULT_SESSION_POLICY: SessionPolicy = {
  maxConcurrentSessions: 3,
  sessionTimeout: 3600, // 1 hour in seconds
  extendOnActivity: true,
  requireMFA: false,
};

const DEFAULT_IP_RESTRICTION_POLICY: IpRestrictionPolicy = {
  enabled: false,
  allowedIPs: [],
  allowedRanges: [],
  blockList: [],
};

const DEFAULT_SECURITY_POLICY: TenantSecurityPolicy = {
  password: DEFAULT_PASSWORD_POLICY,
  session: DEFAULT_SESSION_POLICY,
  ipRestrictions: DEFAULT_IP_RESTRICTION_POLICY,
};

/**
 * Pure validation functions
 */
const isValidIP = (ip: string): boolean => {
  // IPv4 regex pattern
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (!ipv4Pattern.test(ip)) return false;
  
  // Check that each octet is between 0 and 255
  return ip.split('.').map(Number).every(octet => octet >= 0 && octet <= 255);
};

const isValidCIDR = (cidr: string): boolean => {
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;
  
  const ip = parts[0];
  const prefix = parseInt(parts[1], 10);
  
  return isValidIP(ip) && !isNaN(prefix) && prefix >= 0 && prefix <= 32;
};

const validateIpRestrictions = (ipRestrictions: IpRestrictionPolicy): void => {
  if (ipRestrictions?.enabled) {
    // Validate all IP addresses in the allowedIPs array
    if (Array.isArray(ipRestrictions.allowedIPs)) {
      ipRestrictions.allowedIPs.forEach((ip: string) => {
        if (!isValidIP(ip)) {
          throw new Error(`Invalid IP address in allowedIPs: ${ip}`);
        }
      });
    }
    
    // Validate all CIDR ranges in the allowedRanges array
    if (Array.isArray(ipRestrictions.allowedRanges)) {
      ipRestrictions.allowedRanges.forEach((range: string) => {
        if (!isValidCIDR(range)) {
          throw new Error(`Invalid CIDR range in allowedRanges: ${range}`);
        }
      });
    }
    
    // Validate all IP addresses in the blockList array
    if (Array.isArray(ipRestrictions.blockList)) {
      ipRestrictions.blockList.forEach((ip: string) => {
        if (!isValidIP(ip)) {
          throw new Error(`Invalid IP address in blockList: ${ip}`);
        }
      });
    }
  }
};

/**
 * Tenant model definition using functional pattern
 * 
 * @param {Sequelize} sequelize - The Sequelize instance
 * @returns {AssociableModel<TenantAttributes, TenantCreationAttributes>} - The Tenant model with associations
 */
export const defineTenantModel = (sequelize: Sequelize): AssociableModel<TenantAttributes, TenantCreationAttributes> => {
  const TenantModel = sequelize.define<Model<TenantAttributes, TenantCreationAttributes>>(
    'Tenant',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      slug: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: {
          is: /^[a-z0-9-]+$/i,
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [2, 100],
        },
      },
      logo: {
        type: DataTypes.STRING,
        validate: {
          isUrl: {
            msg: 'Logo must be a valid URL',
          },
          isSignedS3Url(value: string): void {
            if (value && !value.includes('X-Amz-Signature')) {
              throw new Error('Logo URL must be a signed S3 URL');
            }
          },
        },
      },
      features: {
        type: DataTypes.JSON,
        defaultValue: {},
      },
      securityPolicy: {
        type: DataTypes.JSON,
        defaultValue: DEFAULT_SECURITY_POLICY,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(TenantStatus)),
        defaultValue: TenantStatus.ACTIVE,
      },
      deletedAt: DataTypes.DATE,
      deletedBy: {
        type: DataTypes.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Tenant',
      tableName: 'Tenants',
      timestamps: true,
      paranoid: true, // Use deletedAt as a flag for soft deletes
      validate: {
        // Custom model-level validation
        securityPolicyValidation(): void {
          const { ipRestrictions } = this.securityPolicy;
          validateIpRestrictions(ipRestrictions);
        },
      },
      hooks: {
        // Hook to validate IP restrictions on updates
        beforeUpdate: (tenant: Model<TenantAttributes>) => {
          const changed = tenant.changed();
          if (changed && changed.includes('securityPolicy')) {
            const { ipRestrictions } = tenant.get('securityPolicy') as TenantSecurityPolicy;
            validateIpRestrictions(ipRestrictions);
          }
        }
      }
    }
  );

  // Define model associations using a typed approach
  const associateTenant = (models: ModelRegistry): void => {
    TenantModel.belongsToMany(models.User, {
      through: models.TenantUser,
      foreignKey: 'tenantId',
    });
    
    TenantModel.hasMany(models.Role, {
      foreignKey: 'tenantId',
    });
    
    TenantModel.hasMany(models.Invitation, {
      foreignKey: 'tenantId',
    });
  };

  // Add association method to model
  const associableModel = TenantModel as AssociableModel<TenantAttributes, TenantCreationAttributes>;
  associableModel.associate = associateTenant;

  return associableModel;
};

export default defineTenantModel;