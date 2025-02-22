const { Tenant, User, TenantUser } = require('../models');
const { v4: uuidv4 } = require('uuid');

class TenantController {
  // Create a new tenant
  async create(req, res) {
    try {
      const { name, slug = uuidv4(), features = {}, securityPolicy = {} } = req.body;
      
      // Create tenant database
      await manager.createTenantDatabase(slug);

      // Create tenant record
      const tenant = await Tenant.create({
        name,
        slug,
        databaseUrl: `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${slug}`,
        features,
        securityPolicy,
        onboardingStatus: 'pending'
      });

      // Create admin user relationship
      await TenantUser.create({
        userId: req.user.id,
        tenantId: tenant.id,
        roles: ['admin']
      });

      // Start onboarding process
      await tenantOnboardingService.startOnboarding(tenant.id);

      res.status(201).json({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        onboardingStatus: tenant.onboardingStatus
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Get tenant details
  async get(req, res) {
    try {
      const tenant = await Tenant.findByPk(req.params.id, {
        include: [{
          model: User,
          through: { attributes: ['roles'] }
        }]
      });
      
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      res.json(tenant);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Update tenant
  async update(req, res) {
    try {
      const { name, features, securityPolicy, status } = req.body;
      const tenant = await Tenant.findByPk(req.params.id);
      
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Create update object with only provided fields
      const updates = {};
      if (name) updates.name = name;
      if (features) updates.features = { ...tenant.features, ...features };
      if (securityPolicy) {
        updates.securityPolicy = { 
          ...tenant.securityPolicy, 
          ...securityPolicy 
        };
      }
      if (status) updates.status = status;

      // Apply updates
      await tenant.update(updates);

      // Create audit log
      await SecurityAuditLog.create({
        userId: req.user.id,
        event: 'TENANT_UPDATED',
        details: {
          tenantId: tenant.id,
          updates
        },
        severity: 'medium'
      });

      // Notify admins
      const admins = await TenantUser.findAll({
        where: {
          tenantId: tenant.id,
          roles: { [Op.contains]: ['admin'] }
        },
        include: [User]
      });

      await Promise.all(admins.map(admin => 
        notificationService.sendSystemNotification(
          admin.userId,
          `Tenant ${tenant.name} was updated by ${req.user.name}`
        )
      ));

      res.json(tenant);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Suspend tenant
  async suspend(req, res) {
    const t = await sequelize.transaction();
    try {
      const { reason } = req.body;
      const tenant = await Tenant.findByPk(req.params.id, { transaction: t });
      
      if (!tenant) {
        await t.rollback();
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Update tenant status
      await tenant.update({ 
        status: 'suspended',
        suspensionReason: reason,
        suspendedAt: new Date(),
        suspendedBy: req.user.id
      }, { transaction: t });

      // Optionally disable user logins
      await tenant.db.models.User.update(
        { isActive: false },
        { where: { tenantId: tenant.id }, transaction: t }
      );

      // Create audit log
      await SecurityAuditLog.create({
        userId: req.user.id,
        event: 'TENANT_SUSPENDED',
        details: {
          tenantId: tenant.id,
          reason,
          suspendedBy: req.user.id
        },
        severity: 'high'
      }, { transaction: t });

      // Notify admins
      const admins = await TenantUser.findAll({
        where: {
          tenantId: tenant.id,
          roles: { [Op.contains]: ['admin'] }
        },
        include: [User],
        transaction: t
      });

      await Promise.all(admins.map(admin => 
        notificationService.sendSystemNotification(
          admin.userId,
          `Tenant ${tenant.name} has been suspended by ${req.user.name}`
        )
      ));

      await t.commit();
      res.json({
        id: tenant.id,
        status: 'suspended',
        suspendedAt: tenant.suspendedAt
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Delete tenant
  async delete(req, res) {
    const t = await sequelize.transaction();
    try {
      const { confirm = false } = req.body;
      const tenant = await Tenant.findByPk(req.params.id, { transaction: t });
      
      if (!tenant) {
        await t.rollback();
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Require confirmation
      if (!confirm) {
        await t.rollback();
        return res.status(202).json({
          message: 'Confirmation required',
          tenant: {
            id: tenant.id,
            name: tenant.name,
            userCount: await TenantUser.count({ where: { tenantId: tenant.id } })
          }
        });
      }

      // Get all tenant users for notification
      const tenantUsers = await TenantUser.findAll({
        where: { tenantId: tenant.id },
        include: [User],
        transaction: t
      });

      // Delete tenant database
      await manager.deleteTenantDatabase(tenant.slug);

      // Delete tenant record
      await tenant.destroy({ transaction: t });

      // Create audit log
      await SecurityAuditLog.create({
        userId: req.user.id,
        event: 'TENANT_DELETED',
        details: {
          tenantId: tenant.id,
          name: tenant.name,
          deletedBy: req.user.id
        },
        severity: 'critical'
      }, { transaction: t });

      // Notify all tenant users
      await Promise.all(tenantUsers.map(user => 
        notificationService.sendEmail({
          to: user.email,
          subject: `Tenant ${tenant.name} has been deleted`,
          template: 'tenant-deleted',
          context: {
            name: user.name,
            tenantName: tenant.name,
            deletedBy: req.user.name,
            date: new Date().toLocaleDateString()
          }
        })
      ));

      await t.commit();
      res.status(204).send();
    } catch (error) {
      await t.rollback();
      res.status(400).json({ error: error.message });
    }
  }

  // Add user to tenant
  async addUser(req, res) {
    try {
      const { userId, roles = ['user'] } = req.body;
      const tenant = await Tenant.findByPk(req.params.id);
      
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const tenantUser = await TenantUser.create({
        userId,
        tenantId: tenant.id,
        roles
      });

      res.status(201).json(tenantUser);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Remove user from tenant
  async removeUser(req, res) {
    const t = await sequelize.transaction();
    try {
      const { tenantId, userId } = req.params;
      const { confirm = false } = req.body;

      // Get tenant and user details
      const tenant = await Tenant.findByPk(tenantId, { transaction: t });
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!tenant || !user) {
        await t.rollback();
        return res.status(404).json({ error: 'Tenant or user not found' });
      }

      // Check if user is the last admin
      const adminCount = await TenantUser.count({
        where: {
          tenantId,
          roles: { [Op.contains]: ['admin'] }
        },
        transaction: t
      });

      const userRoles = await TenantUser.findOne({
        where: { tenantId, userId },
        transaction: t
      });

      if (!userRoles) {
        await t.rollback();
        return res.status(404).json({ error: 'User not found in tenant' });
      }

      if (userRoles.roles.includes('admin') && adminCount === 1) {
        await t.rollback();
        return res.status(400).json({ 
          error: 'Cannot remove last admin. Assign another admin first.' 
        });
      }

      // Require confirmation
      if (!confirm) {
        await t.rollback();
        return res.status(202).json({
          message: 'Confirmation required',
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          },
          tenant: {
            id: tenant.id,
            name: tenant.name
          }
        });
      }

      // Remove user from tenant
      await TenantUser.destroy({
        where: { tenantId, userId },
        transaction: t
      });

      // Create audit log
      await SecurityAuditLog.create({
        userId: req.user.id,
        event: 'USER_REMOVED_FROM_TENANT',
        details: {
          removedUserId: userId,
          tenantId,
          roles: userRoles.roles
        },
        severity: 'medium'
      }, { transaction: t });

      // Send notification email
      await emailService.sendEmail({
        to: user.email,
        subject: `You've been removed from ${tenant.name}`,
        template: 'user-removed',
        context: {
          name: user.name,
          tenantName: tenant.name,
          removedBy: req.user.name,
          date: new Date().toLocaleDateString()
        }
      });

      await t.commit();
      res.status(204).send();
    } catch (error) {
      await t.rollback();
      res.status(400).json({ error: error.message });
    }
  }

  // Update user roles in tenant
  async updateUserRoles(req, res) {
    try {
      const { roles } = req.body;
      const tenantUser = await TenantUser.findOne({
        where: {
          tenantId: req.params.id,
          userId: req.params.userId
        }
      });

      if (!tenantUser) {
        return res.status(404).json({ error: 'User not found in tenant' });
      }

      await tenantUser.update({ roles });
      res.json(tenantUser);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new TenantController();
