import { DataTypes, Model, Sequelize, Optional } from 'sequelize';

/**
 * Define the Invitation attributes interface
 */
export interface InvitationAttributes {
  id: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: Date;
  tenantId: string;
  invitedById: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for Invitation creation attributes (with optional fields for creation)
 */
type InvitationCreationAttributes = Optional<
  InvitationAttributes,
  | 'id'
  | 'status'
  | 'cancelledAt'
  | 'cancelledBy'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * Invitation model definition using functional pattern
 */
export const defineInvitationModel = (
  sequelize: Sequelize
): Model<InvitationAttributes, InvitationCreationAttributes> => {
  const InvitationModel = sequelize.define<Model<InvitationAttributes, InvitationCreationAttributes>>(
    'Invitation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: {
            msg: 'Must be a valid email address',
          },
        },
      },
      token: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'expired', 'cancelled'),
        defaultValue: 'pending',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Tenants',
          key: 'id',
        },
      },
      invitedById: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      cancelledAt: DataTypes.DATE,
      cancelledBy: {
        type: DataTypes.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Invitation',
      tableName: 'Invitations',
      timestamps: true,
      indexes: [
        {
          fields: ['email', 'tenantId', 'status'],
          unique: true,
          where: {
            status: 'pending',
          },
          name: 'pending_invitation_unique',
        },
      ],
    }
  );

  // Define model associations using a function approach
  const associateInvitation = (models: Record<string, Model>): void => {
    InvitationModel.belongsTo(models.Tenant as Model);
    InvitationModel.belongsTo(models.User as Model, {
      foreignKey: 'invitedById',
    });
    InvitationModel.belongsTo(models.User as Model, {
      foreignKey: 'cancelledBy',
      as: 'cancelledByUser',
    });
  };

  // Add association method to model
  (InvitationModel as any).associate = associateInvitation;

  return InvitationModel;
};

export default defineInvitationModel;