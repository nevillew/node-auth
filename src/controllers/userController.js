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
  static validations = {
    create: validate(createUserSchema),
    update: validate(updateUserSchema),
    changePassword: validate(changePasswordSchema)
  };
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
