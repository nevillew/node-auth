const { Tenant, User, TenantUser } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3 } = require('../middleware/fileUpload');

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

      // Start onboarding and send notifications
      await Promise.all([
        tenantOnboardingService.startOnboarding(tenant.id),
        slackService.sendMessage({
          channel: '#tenant-activity',
          text: `New tenant created: ${tenant.name}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*New Tenant Created*\nName: ${tenant.name}\nCreated by: ${req.user.email}`
              }
            }
          ]
        })
      ]);

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

  // Restore tenant
  async restore(req, res) {
    const t = await sequelize.transaction();
    try {
      const tenant = await Tenant.findByPk(req.params.id, { transaction: t });
      
      if (!tenant) {
        await t.rollback();
        return res.status(404).json({ error: 'Tenant not found' });
      }

      if (tenant.status !== 'pending_deletion') {
        await t.rollback();
        return res.status(400).json({ error: 'Tenant is not pending deletion' });
      }

      await tenant.update({
        status: 'active',
        deletionRequestedAt: null,
        deletionScheduledAt: null
      }, { transaction: t });

      // Create audit log
      await SecurityAuditLog.create({
        userId: req.user.id,
        event: 'TENANT_RESTORED',
        details: {
          tenantId: tenant.id,
          name: tenant.name,
          restoredBy: req.user.id
        },
        severity: 'medium'
      }, { transaction: t });

      // Notify all tenant users
      const tenantUsers = await TenantUser.findAll({
        where: { tenantId: tenant.id },
        include: [User],
        transaction: t
      });

      await Promise.all(tenantUsers.map(user => 
        notificationService.sendEmail({
          to: user.email,
          subject: `Tenant ${tenant.name} restoration`,
          template: 'tenant-restored',
          context: {
            name: user.name,
            tenantName: tenant.name,
            restoredBy: req.user.name,
            date: new Date().toLocaleDateString()
          }
        })
      ));

      await t.commit();
      res.json({ message: 'Tenant restored successfully' });
    } catch (error) {
      await t.rollback();
      res.status(400).json({ error: error.message });
    }
  }

  // Process scheduled deletions
  async processScheduledDeletions() {
    const tenants = await Tenant.findAll({
      where: {
        status: 'pending_deletion',
        deletionScheduledAt: {
          [Op.lte]: new Date()
        }
      }
    });

    // Generate signed URLs for logos
    await Promise.all(tenants.map(async (tenant) => {
      if (tenant.logo) {
        tenant.logoUrl = await getSignedUrl(s3, new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: tenant.logo
        }), { expiresIn: 24 * 60 * 60 });
      }
    }));

    for (const tenant of tenants) {
      const t = await sequelize.transaction();
      try {
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
          userId: null, // System action
          event: 'TENANT_DELETED',
          details: {
            tenantId: tenant.id,
            name: tenant.name
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
              date: new Date().toLocaleDateString()
            }
          })
        ));

        await t.commit();
      } catch (error) {
        await t.rollback();
        logger.error(`Failed to delete tenant ${tenant.id}:`, error);
      }
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

      // Generate fresh signed URL if logo exists
      if (tenant.logo) {
        tenant.logoUrl = await getSignedUrl(s3, new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: tenant.logo
        }), { expiresIn: 24 * 60 * 60 });
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
      
      // Handle logo upload if present
      if (req.file) {
        const { key, signedUrl } = await uploadToS3(req.file, 'tenant-logos', 24 * 60 * 60); // 24 hour signed URL
        updates.logo = key;
        updates.logoUrl = signedUrl;
      }
      
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

      await Promise.all([
        t.commit(),
        slackService.sendMessage({
          channel: '#tenant-activity',
          text: `Tenant suspended: ${tenant.name}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Tenant Suspended*\nName: ${tenant.name}\nReason: ${reason}\nSuspended by: ${req.user.email}`
              }
            }
          ]
        })
      ]);

      res.json({
        id: tenant.id,
        status: 'suspended',
        suspendedAt: tenant.suspendedAt
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Request tenant deletion
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

      // Mark tenant for deletion
      const deletionDate = new Date(Date.now() + (tenant.gracePeriodDays * 24 * 60 * 60 * 1000));
      await tenant.update({
        status: 'pending_deletion',
        deletionRequestedAt: new Date(),
        deletionScheduledAt: deletionDate
      }, { transaction: t });

      // Create audit log
      await SecurityAuditLog.create({
        userId: req.user.id,
        event: 'TENANT_DELETION_REQUESTED',
        details: {
          tenantId: tenant.id,
          name: tenant.name,
          requestedBy: req.user.id,
          scheduledAt: deletionDate
        },
        severity: 'high'
      }, { transaction: t });

      // Notify all tenant users
      const tenantUsers = await TenantUser.findAll({
        where: { tenantId: tenant.id },
        include: [User],
        transaction: t
      });

      await Promise.all(tenantUsers.map(user => 
        notificationService.sendEmail({
          to: user.email,
          subject: `Tenant ${tenant.name} scheduled for deletion`,
          template: 'tenant-deletion-scheduled',
          context: {
            name: user.name,
            tenantName: tenant.name,
            requestedBy: req.user.name,
            deletionDate: deletionDate.toLocaleDateString(),
            gracePeriodDays: tenant.gracePeriodDays
          }
        })
      ));

      await Promise.all([
        t.commit(),
        slackService.sendMessage({
          channel: '#tenant-activity',
          text: `Tenant pending deletion: ${tenant.name}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Tenant Pending Deletion*\nName: ${tenant.name}\nScheduled for: ${deletionDate.toISOString()}\nRequested by: ${req.user.email}`
              }
            }
          ]
        })
      ]);

      res.json({
        message: `Tenant scheduled for deletion in ${tenant.gracePeriodDays} days`,
        deletionDate
      });
    } catch (error) {
      await t.rollback();
      res.status(400).json({ error: error.message });
    }
  }

  // Add user to tenant

  async acceptInvitation(req, res) {
    const t = await sequelize.transaction();
    try {
      const { token, password } = req.body;
      
      // Find valid invitation
      const invitation = await Invitation.findOne({
        where: {
          token,
          status: 'pending',
          expiresAt: { [Op.gt]: new Date() }
        },
        include: [Tenant],
        transaction: t
      });

      if (!invitation) {
        await t.rollback();
        return res.status(400).json({ error: 'Invalid or expired invitation' });
      }

      // Find or create user
      let user = await User.findOne({ 
        where: { email: invitation.email },
        transaction: t 
      });

      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await User.create({
          email: invitation.email,
          password: hashedPassword,
          status: 'active',
          profile: {
            timezone: 'UTC',
            language: 'en'
          }
        }, { transaction: t });
      }

      // Create tenant user relationship
      await TenantUser.create({
        userId: user.id,
        tenantId: invitation.tenantId,
        roles: invitation.roles
      }, { transaction: t });

      // Update invitation status
      await invitation.update({
        status: 'accepted',
        acceptedAt: new Date()
      }, { transaction: t });

      // Create audit log
      await SecurityAuditLog.create({
        userId: user.id,
        event: 'INVITATION_ACCEPTED',
        details: {
          tenantId: invitation.tenantId,
          roles: invitation.roles
        },
        severity: 'medium'
      }, { transaction: t });

      // Send welcome email
      await emailService.sendWelcomeEmail(
        user.email,
        user.name || user.email
      );

      await t.commit();
      res.json({ 
        message: 'Invitation accepted successfully',
        userId: user.id,
        tenantId: invitation.tenantId
      });
    } catch (error) {
      await t.rollback();
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
