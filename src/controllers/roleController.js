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
      const role = await Role.findByPk(req.params.id, { transaction: t });

      if (!role) {
        await t.rollback();
        throw new AppError('Role not found', 404);
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

      // Update role
      await role.update({
        name: name || role.name,
        description: description || role.description,
        scopes: scopes || role.scopes
      }, { transaction: t });

      // Update permissions if provided
      if (permissions) {
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
          updates: { name, description, scopes, permissions }
        },
        severity: 'medium'
      }, { transaction: t });

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
      const role = await Role.findByPk(req.params.id, { transaction: t });

      if (!role) {
        await t.rollback();
        throw new AppError('Role not found', 404);
      }

      if (role.isDefault) {
        await t.rollback();
        throw new AppError('Cannot delete default role', 400);
      }

      // Check if role has any users
      const userCount = await role.countUsers({ transaction: t });
      if (userCount > 0) {
        await t.rollback();
        throw new AppError('Cannot delete role with assigned users', 400);
      }

      await role.destroy({ transaction: t });

      // Create audit log
      await SecurityAuditLog.create({
        userId: req.user.id,
        event: 'ROLE_DELETED',
        details: {
          roleId: role.id,
          name: role.name
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
      const roles = await Role.findAll({
        where: { tenantId: req.tenant.id },
        include: [Permission]
      });
      res.json(roles);
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
