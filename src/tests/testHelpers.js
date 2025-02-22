const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    email: 'test@example.com',
    password: await bcrypt.hash('Password123!', 10),
    name: 'Test User'
  };

  return User.create({ ...defaultUser, ...overrides });
};

const generateAuthToken = async (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

module.exports = {
  createTestUser,
  generateAuthToken
};
