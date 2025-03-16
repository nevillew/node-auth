import SequelizeOriginal from 'sequelize';
const { Sequelize } = SequelizeOriginal as any;
import { DataTypes, Model, Optional } from 'sequelize';

/**
 * Define the Authenticator attributes interface
 */
export interface AuthenticatorAttributes {
  id: string;
  userId: string;
  credentialID: Buffer;
  credentialPublicKey: Buffer;
  counter: number;
  transports: string[];
  friendlyName: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for Authenticator creation attributes (with optional fields for creation)
 */
type AuthenticatorCreationAttributes = Optional<
  AuthenticatorAttributes,
  | 'id'
  | 'counter'
  | 'transports'
  | 'friendlyName'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * Authenticator model definition using functional pattern
 */
export const defineAuthenticatorModel = (
  sequelize: Sequelize
): Model<AuthenticatorAttributes, AuthenticatorCreationAttributes> => {
  const AuthenticatorModel = sequelize.define<Model<AuthenticatorAttributes, AuthenticatorCreationAttributes>>(
    'Authenticator',
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
      credentialID: {
        type: DataTypes.BLOB,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: {
            msg: 'Credential ID cannot be empty',
          },
        },
      },
      credentialPublicKey: {
        type: DataTypes.BLOB,
        allowNull: false,
      },
      counter: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      transports: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
      },
      friendlyName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Primary Authenticator',
        validate: {
          notEmpty: {
            msg: 'Friendly name cannot be empty',
          },
          len: {
            args: [1, 50],
            msg: 'Friendly name must be between 1 and 50 characters',
          },
        },
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Authenticator',
      tableName: 'Authenticators',
      timestamps: true,
    }
  );

  // Define model associations using a function approach
  const associateAuthenticator = (models: Record<string, Model>): void => {
    AuthenticatorModel.belongsTo(models.User as Model, {
      foreignKey: 'userId',
      onDelete: 'CASCADE',
    });
  };

  // Add association method to model
  (AuthenticatorModel as any).associate = associateAuthenticator;

  return AuthenticatorModel;
};

export default defineAuthenticatorModel;