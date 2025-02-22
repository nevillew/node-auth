const { Tenant, User, TenantUser } = require('../models');
const { v4: uuidv4 } = require('uuid');

class TenantController {
  // Create a new tenant
  async create(req, res) {
    try {
      const { name, slug = uuidv4(), features = {}, securityPolicy = {} } = req.body;
      
      const tenant = await Tenant.create({
        name,
        slug,
        databaseUrl: `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${slug}`,
        features,
        securityPolicy
      });

      // Create admin user relationship
      await TenantUser.create({
        userId: req.user.id,
        tenantId: tenant.id,
        roles: ['admin']
      });

      res.status(201).json(tenant);
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

      await tenant.update({
        name,
        features,
        securityPolicy,
        status
      });

      res.json(tenant);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Suspend tenant
  async suspend(req, res) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      await tenant.update({ status: 'suspended' });
      res.json(tenant);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Delete tenant
  async delete(req, res) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      await tenant.destroy();
      res.status(204).send();
    } catch (error) {
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
    try {
      const result = await TenantUser.destroy({
        where: {
          tenantId: req.params.id,
          userId: req.params.userId
        }
      });

      if (!result) {
        return res.status(404).json({ error: 'User not found in tenant' });
      }

      res.status(204).send();
    } catch (error) {
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
