const { User, Tenant, TenantUser } = require('../models');
const bcrypt = require('bcrypt');
const { AppError } = require('../middleware/errorHandler');
const validate = require('../middleware/validate');
const { 
  createUserSchema, 
  updateUserSchema, 
  changePasswordSchema 
} = require('../validations/userValidations');

class UserController {
  static async getValidations(tenantId) {
    return {
      create: validate(await createUserSchema(tenantId)),
      update: validate(updateUserSchema),
      changePassword: validate(await changePasswordSchema(tenantId)),
      search: validate(searchUserSchema),
      bulkUpdate: validate(bulkUpdateSchema)
    };
  }

  // Search users with filtering
  async search(req, res) {
    try {
      const { 
        query, 
        status, 
        role, 
        tenant,
        lastLoginStart,
        lastLoginEnd,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      const where = {};
      
      if (query) {
        where[Op.or] = [
          { email: { [Op.iLike]: `%${query}%` } },
          { name: { [Op.iLike]: `%${query}%` } }
        ];
      }
      
      if (status) where.status = status;
      if (tenant) where.tenantId = tenant;
      
      if (lastLoginStart || lastLoginEnd) {
        where.lastLoginAt = {};
        if (lastLoginStart) where.lastLoginAt[Op.gte] = new Date(lastLoginStart);
        if (lastLoginEnd) where.lastLoginAt[Op.lte] = new Date(lastLoginEnd);
      }

      const users = await User.findAndCountAll({
        where,
        include: [{
          model: Role,
          where: role ? { name: role } : undefined,
          required: !!role
        }],
        order: [[sortBy, sortOrder]],
        limit,
        offset: (page - 1) * limit,
        attributes: { exclude: ['password'] }
      });

      res.json({
        users: users.rows,
        total: users.count,
        page,
        totalPages: Math.ceil(users.count / limit)
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  // Bulk operations
  async bulkUpdate(req, res) {
    const { userIds, updates } = req.body;
    const t = await sequelize.transaction();

    try {
      const users = await User.update(updates, {
        where: { id: userIds },
        transaction: t
      });

      await ActivityLog.bulkCreate(userIds.map(userId => ({
        userId,
        action: 'BULK_UPDATE',
        details: updates
      })), { transaction: t });

      await t.commit();
      res.json({ updated: users[0] });
    } catch (error) {
      await t.rollback();
      next(new AppError(error.message, 400));
    }
  }

  // Status management
  async updateStatus(req, res) {
    const { userId } = req.params;
    const { status, reason } = req.body;

    try {
      const user = await User.findByPk(userId);
      if (!user) throw new AppError('User not found', 404);

      await user.update({ 
        status,
        statusReason: reason,
        statusChangedAt: new Date(),
        statusChangedBy: req.user.id
      });

      await ActivityLog.create({
        userId,
        action: 'STATUS_CHANGE',
        details: { status, reason }
      });

      res.json(user);
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  // Role assignment
  async assignRoles(req, res) {
    const { userId } = req.params;
    const { roles } = req.body;
    const t = await sequelize.transaction();

    try {
      const user = await User.findByPk(userId);
      if (!user) throw new AppError('User not found', 404);

      await UserRole.destroy({ 
        where: { userId },
        transaction: t
      });

      await UserRole.bulkCreate(
        roles.map(roleId => ({ userId, roleId })),
        { transaction: t }
      );

      await ActivityLog.create({
        userId,
        action: 'ROLE_ASSIGNMENT',
        details: { roles }
      }, { transaction: t });

      await t.commit();
      res.json({ message: 'Roles updated successfully' });
    } catch (error) {
      await t.rollback();
      next(new AppError(error.message, 400));
    }
  }

  // Permission management
  async updatePermissions(req, res) {
    const { userId } = req.params;
    const { permissions } = req.body;
    const t = await sequelize.transaction();

    try {
      const user = await User.findByPk(userId);
      if (!user) throw new AppError('User not found', 404);

      await UserPermission.destroy({ 
        where: { userId },
        transaction: t
      });

      await UserPermission.bulkCreate(
        permissions.map(permissionId => ({ userId, permissionId })),
        { transaction: t }
      );

      await ActivityLog.create({
        userId,
        action: 'PERMISSION_UPDATE',
        details: { permissions }
      }, { transaction: t });

      await t.commit();
      res.json({ message: 'Permissions updated successfully' });
    } catch (error) {
      await t.rollback();
      next(new AppError(error.message, 400));
    }
  }

  // Activity monitoring
  async getActivity(req, res) {
    const { userId } = req.params;
    const { startDate, endDate, type, page = 1, limit = 20 } = req.query;

    try {
      const where = { userId };
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }
      
      if (type) where.action = type;

      const logs = await ActivityLog.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset: (page - 1) * limit
      });

      res.json({
        logs: logs.rows,
        total: logs.count,
        page,
        totalPages: Math.ceil(logs.count / limit)
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  // Account deactivation
  async deactivate(req, res) {
    const { userId } = req.params;
    const { reason } = req.body;
    const t = await sequelize.transaction();

    try {
      const user = await User.findByPk(userId);
      if (!user) throw new AppError('User not found', 404);

      await user.update({
        status: 'inactive',
        deactivatedAt: new Date(),
        deactivatedBy: req.user.id,
        deactivationReason: reason
      }, { transaction: t });

      // Revoke all sessions
      await OAuthToken.destroy({
        where: { userId },
        transaction: t
      });

      await ActivityLog.create({
        userId,
        action: 'ACCOUNT_DEACTIVATED',
        details: { reason }
      }, { transaction: t });

      await t.commit();
      res.json({ message: 'Account deactivated successfully' });
    } catch (error) {
      await t.rollback();
      next(new AppError(error.message, 400));
    }
  }
  // Create a new user
  async create(req, res) {
    try {
      const { email, password, name, avatar } = req.body;
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await User.create({
        email,
        password: hashedPassword,
        name,
        avatar
      });

      res.status(201).json({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Get user details with profile and activity
  async get(req, res) {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [{
          model: Tenant,
          through: { attributes: ['roles'] }
        }, {
          model: LoginHistory,
          limit: 5,
          order: [['createdAt', 'DESC']]
        }, {
          model: ActivityLog,
          limit: 10,
          order: [['createdAt', 'DESC']]
        }],
        attributes: { 
          exclude: ['password'],
          include: [
            'profile',
            'preferences',
            'emailPreferences',
            'lastActivity'
          ]
        }
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Update user
  async update(req, res) {
    try {
      const { name, avatar } = req.body;
      const user = await User.findByPk(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await user.update({
        name,
        avatar
      });

      const updatedUser = await User.findByPk(user.id, {
        attributes: { exclude: ['password'] }
      });

      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Delete user
  async delete(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await user.destroy();
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findByPk(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid current password' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await user.update({ password: hashedPassword });

      res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Get user's tenants
  async getTenants(req, res) {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [{
          model: Tenant,
          through: { attributes: ['roles'] }
        }]
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user.Tenants);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new UserController();
