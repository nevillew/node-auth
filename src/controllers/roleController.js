const { Role, Permission, RolePermission } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

class RoleController {
  async create(req, res) {
    const t = await sequelize.transaction();
    try {
      const { name, description, scopes, permissions } = req.body;
      const tenantId = req.tenant.id;

      // Check for duplicate role name in tenant
      const existingRole = await Role.findOne({
        where: { name, tenantId },
        transaction: t
      });

      if (existingRole) {
        await t.rollback();
        throw new AppError('Role with this name already exists', 409);
      }

      // Create role
      const role = await Role.create({
        name,
        description,
        scopes,
        tenantId
      }, { transaction: t });

      // Assign permissions if provided
      if (permissions && permissions.length > 0) {
        await RolePermission.bulkCreate(
          permissions.map(permissionId => ({
            roleId: role.id,
            permissionId
          })),
          { transaction: t }
        );
      }

      // Create audit log
      await SecurityAuditLog.create({
        userId: req.user.id,
        event: 'ROLE_CREATED',
        details: {
          roleId: role.id,
          name,
          scopes,
          permissions
        },
        severity: 'medium'
      }, { transaction: t });

      await t.commit();

      // Fetch role with permissions
      const createdRole = await Role.findByPk(role.id, {
        include: [Permission]
      });

      res.status(201).json(createdRole);
    } catch (error) {
      await t.rollback();
      logger.error('Role creation failed:', error);
      throw error;
    }
  }

  async update(req, res) {
    const t = await sequelize.transaction();
    try {
      const { name, description, scopes, permissions } = req.body;
      const role = await Role.findByPk(req.params.id, { 
        include: [
          {
            model: User,
            attributes: ['id', 'email', 'name']
          },
          Permission
        ],
        transaction: t 
      });

      if (!role) {
        await t.rollback();
        throw new AppError('Role not found', 404);
      }

      // Check if user has permission to modify this role
      if (role.isDefault && !req.user.hasScope('admin')) {
        await t.rollback();
        throw new AppError('Cannot modify default role without admin scope', 403);
      }

      // Check for duplicate name if name is being changed
      if (name && name !== role.name) {
        const existingRole = await Role.findOne({
          where: { 
            name,
            tenantId: role.tenantId,
            id: { [Op.ne]: role.id }
          },
          transaction: t
        });

        if (existingRole) {
          await t.rollback();
          throw new AppError('Role with this name already exists', 409);
        }
      }

      // Track changes for audit
      const changes = {};
      if (name && name !== role.name) changes.name = { from: role.name, to: name };
      if (description && description !== role.description) changes.description = { from: role.description, to: description };
      if (scopes) changes.scopes = { from: role.scopes, to: scopes };

      // Update role
      await role.update({
        name: name || role.name,
        description: description || role.description,
        scopes: scopes || role.scopes
      }, { transaction: t });

      // Update permissions if provided
      if (permissions) {
        const currentPermissions = role.Permissions.map(p => p.id);
        const added = permissions.filter(p => !currentPermissions.includes(p));
        const removed = currentPermissions.filter(p => !permissions.includes(p));

        changes.permissions = {
          added,
          removed
        };

        await RolePermission.destroy({
          where: { roleId: role.id },
          transaction: t
        });

        if (permissions.length > 0) {
          await RolePermission.bulkCreate(
            permissions.map(permissionId => ({
              roleId: role.id,
              permissionId
            })),
            { transaction: t }
          );
        }
      }

      // Create audit log
      await SecurityAuditLog.create({
        userId: req.user.id,
        event: 'ROLE_UPDATED',
        details: {
          roleId: role.id,
          changes,
          affectedUsers: role.Users.length
        },
        severity: 'medium'
      }, { transaction: t });

      // Notify affected users
      await Promise.all(role.Users.map(user => 
        notificationService.sendSystemNotification(
          user.id,
          `The role "${role.name}" has been updated by ${req.user.name}`
        )
      ));

      await t.commit();

      // Fetch updated role with permissions
      const updatedRole = await Role.findByPk(role.id, {
        include: [Permission]
      });

      res.json(updatedRole);
    } catch (error) {
      await t.rollback();
      logger.error('Role update failed:', error);
      throw error;
    }
  }

  async delete(req, res) {
    const t = await sequelize.transaction();
    try {
      const { confirm = false } = req.body;
      const role = await Role.findByPk(req.params.id, {
        include: [
          {
            model: User,
            attributes: ['id', 'email', 'name']
          },
          Permission
        ],
        transaction: t
      });

      if (!role) {
        await t.rollback();
        throw new AppError('Role not found', 404);
      }

      if (role.isDefault) {
        await t.rollback();
        throw new AppError('Cannot delete default role', 400);
      }

      // Check if role has any users
      if (role.Users.length > 0) {
        if (!confirm) {
          await t.rollback();
          return res.status(409).json({
            error: 'Role has assigned users',
            requiresConfirmation: true,
            affectedUsers: role.Users.length,
            users: role.Users.map(u => ({
              id: u.id,
              email: u.email,
              name: u.name
            }))
          });
        }

        // Notify affected users before deletion
        await Promise.all(role.Users.map(user =>
          notificationService.sendSystemNotification(
            user.id,
            `The role "${role.name}" you were assigned to has been deleted by ${req.user.name}`
          )
        ));
      }

      // Remove role permissions
      await RolePermission.destroy({
        where: { roleId: role.id },
        transaction: t
      });

      // Remove role from users
      await UserRole.destroy({
        where: { roleId: role.id },
        transaction: t
      });

      // Delete the role
      await role.destroy({ transaction: t });

      // Create audit log
      await SecurityAuditLog.create({
        userId: req.user.id,
        event: 'ROLE_DELETED',
        details: {
          roleId: role.id,
          name: role.name,
          permissions: role.Permissions.map(p => p.name),
          affectedUsers: role.Users.length
        },
        severity: 'high'
      }, { transaction: t });

      await t.commit();
      res.status(204).send();
    } catch (error) {
      await t.rollback();
      logger.error('Role deletion failed:', error);
      throw error;
    }
  }

  async list(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'name',
        sortOrder = 'ASC',
        search,
        isDefault
      } = req.query;

      const where = { tenantId: req.tenant.id };

      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }

      if (isDefault !== undefined) {
        where.isDefault = isDefault === 'true';
      }

      const roles = await Role.findAndCountAll({
        where,
        include: [{
          model: Permission,
          through: { attributes: [] }
        }, {
          model: User,
          attributes: ['id'],
          through: { attributes: [] }
        }],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        distinct: true
      });

      res.json({
        roles: roles.rows.map(role => ({
          id: role.id,
          name: role.name,
          description: role.description,
          scopes: role.scopes,
          isDefault: role.isDefault,
          permissions: role.Permissions,
          userCount: role.Users.length,
          createdAt: role.createdAt
        })),
        total: roles.count,
        page: parseInt(page),
        totalPages: Math.ceil(roles.count / limit)
      });
    } catch (error) {
      logger.error('Role listing failed:', error);
      throw error;
    }
  }

  async get(req, res) {
    try {
      const role = await Role.findByPk(req.params.id, {
        include: [Permission]
      });

      if (!role) {
        throw new AppError('Role not found', 404);
      }

      res.json(role);
    } catch (error) {
      logger.error('Role retrieval failed:', error);
      throw error;
    }
  }
}

module.exports = new RoleController();
