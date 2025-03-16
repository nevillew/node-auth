import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { UserAttributes } from '../types';

interface TestUserOverrides {
  email?: string;
  password?: string;
  name?: string;
  [key: string]: any;
}

/**
 * Creates a test user for testing purposes
 * 
 * @param overrides - Optional properties to override defaults
 * @returns Promise resolving to the created user
 */
const createTestUser = async (overrides: TestUserOverrides = {}): Promise<any> => {
  const defaultUser = {
    email: 'test@example.com',
    password: await bcrypt.hash('Password123!', 10),
    name: 'Test User'
  };

  return User.create({ ...defaultUser, ...overrides });
};

/**
 * Generates an authentication token for a user
 * 
 * @param user - The user to generate a token for
 * @returns Promise resolving to the generated token
 */
const generateAuthToken = async (user: any): Promise<string> => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

export {
  createTestUser,
  generateAuthToken
};