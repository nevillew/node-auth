const { Role, User, UserRole, SecurityAuditLog } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');
const notificationService = require('./notificationService');

class RoleService {
  async assignRolesToUser(userId, roleIds, assignedBy) {
    const t = await sequelize.transaction();
    try {
      const user = await User.findByPk(userId, {
        include: [Role],
        transaction: t
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Verify all roles exist
      const roles = await Role.findAll({
        where: { id: roleIds },
        transaction: t
      });

      if (roles.length !== roleIds.length) {
        throw new AppError('One or more roles not found', 400);
      }

      // Check if removing admin role and user is last admin
      const currentRoles = user.Roles;
      const isLosingAdmin = currentRoles.some(r => 
        r.name === 'admin' && !roleIds.includes(r.id)
      );

      if (isLosingAdmin) {
        const adminCount = await UserRole.count({
          where: { roleId: currentRoles.find(r => r.name === 'admin').id },
          transaction: t
        });

        if (adminCount === 1) {
          throw new AppError('Cannot remove last admin role', 400);
        }
      }

      // Remove existing roles
      await UserRole.destroy({
        where: { userId },
        transaction: t
      });

      // Assign new roles
      await UserRole.bulkCreate(
        roleIds.map(roleId => ({
          userId,
          roleId
        })),
        { transaction: t }
      );

      // Create audit log
      await SecurityAuditLog.create({
        userId: assignedBy,
        event: 'ROLES_ASSIGNED',
        details: {
          targetUserId: userId,
          previousRoles: currentRoles.map(r => ({ id: r.id, name: r.name })),
          newRoles: roles.map(r => ({ id: r.id, name: r.name }))
        },
        severity: 'medium'
      }, { transaction: t });

      // Notify user
      await notificationService.sendSystemNotification(
        userId,
        `Your roles have been updated by ${assignedBy}`
      );

      await t.commit();

      return roles;
    } catch (error) {
      await t.rollback();
      logger.error('Role assignment failed:', error);
      throw error;
    }
  }

  async getUserRoles(userId) {
    const user = await User.findByPk(userId, {
      include: [{
        model: Role,
        through: { attributes: [] }
      }]
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user.Roles;
  }
}

module.exports = new RoleService();
