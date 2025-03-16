import bcrypt from 'bcrypt';
import crypto from 'crypto';
import validator from 'validator';
import { Op, Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

// Import models and types
import db from '../models';
import { UserAttributes, ServiceResult, ErrorCode } from '../types';
import { Result, success, failure, chainResult, fromPromise, tryCatch } from '../utils/errors';
import { composeAsync, sequenceResults, transformResult, combineResults, compose } from '../utils/compose';
import { withTransaction } from '../utils/transactions';

// Types for user service
interface CreateUserParams {
  email: string;
  password: string;
  name: string;
  avatar?: string;
}

interface UpdateUserParams {
  name?: string;
  avatar?: string;
  preferences?: Partial<UserAttributes['preferences']>;
}

interface SearchUserParams {
  query?: string;
  status?: 'active' | 'inactive' | 'suspended';
  role?: string;
  tenant?: string;
  lastLoginStart?: string;
  lastLoginEnd?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Utility functions
/**
 * Sanitize user input to prevent XSS and other attacks
 */
const sanitizeUserInput = (input: CreateUserParams): Result<CreateUserParams> => {
  try {
    const { email, password, name, avatar } = input;
    
    return success({
      email: validator.escape(email.trim()),
      password,
      name: validator.escape(name.trim()),
      avatar: avatar ? validator.escape(avatar.trim()) : undefined,
    });
  } catch (err) {
    return failure({
      message: 'Error sanitizing user input',
      statusCode: 400,
      originalError: err instanceof Error ? err : new Error('Unknown error'),
    });
  }
};

/**
 * Hash a password using bcrypt
 */
const hashPassword = async (password: string): Promise<Result<string>> => {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    return success(hashedPassword);
  } catch (err) {
    return failure({
      message: 'Error hashing password',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error'),
    });
  }
};

/**
 * Generate a verification token
 */
const generateVerificationToken = (): Result<{
  token: string;
  expires: Date;
}> => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return success({ token, expires });
  } catch (err) {
    return failure({
      message: 'Error generating verification token',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error'),
    });
  }
};

// User service functions
/**
 * Create a new user
 */
export const createUser = async (
  params: CreateUserParams,
  requestUserId?: string,
  externalTransaction?: Transaction
): Promise<Result<UserAttributes>> => {
  // Use the withTransaction utility for better transaction handling
  return withTransaction(async (t) => {
    // Sanitize input
    const sanitizedResult = sanitizeUserInput(params);
    if (!sanitizedResult.ok) return sanitizedResult;
    
    const sanitizedInput = sanitizedResult.value;
    
    // Check for existing user using chainResult for functional flow
    const checkExistingUser = async (): Promise<Result<void>> => {
      const existingUser = await db.User.findOne({
        where: { email: sanitizedInput.email },
        transaction: t,
      });
      
      if (existingUser) {
        return failure({
          message: 'User already exists',
          statusCode: 409,
          code: ErrorCode.RESOURCE_ALREADY_EXISTS
        });
      }
      
      return success(undefined);
    };
    
    // Hash password
    const prepareHashedPassword = async (): Promise<Result<string>> => {
      return hashPassword(sanitizedInput.password);
    };
    
    // Generate verification token
    const prepareVerificationToken = (): Result<{
      token: string;
      expires: Date;
    }> => {
      return generateVerificationToken();
    };
    
    // Create user with a structured approach
    const createUserRecord = async (
      hashedPassword: string, 
      verification: { token: string; expires: Date }
    ): Promise<Result<UserAttributes>> => {
      try {
        const user = await db.User.create(
          {
            id: uuidv4(),
            email: sanitizedInput.email,
            password: hashedPassword,
            name: sanitizedInput.name,
            avatar: sanitizedInput.avatar,
            verificationToken: verification.token,
            verificationTokenExpires: verification.expires,
            profile: {
              timezone: 'UTC',
              language: 'en',
            },
            preferences: {
              theme: 'light',
              notifications: {
                email: true,
                push: true,
                sms: false,
              },
              accessibility: {
                highContrast: false,
                fontSize: 'normal',
              },
              privacy: {
                profileVisibility: 'public',
                activityVisibility: 'private',
              },
            },
            emailPreferences: {
              marketing: true,
              updates: true,
              security: true,
              newsletter: false,
            },
          },
          { transaction: t }
        );
        
        // Create audit log
        await db.SecurityAuditLog.create(
          {
            id: uuidv4(),
            userId: user.id,
            event: 'USER_CREATED',
            details: {
              createdBy: requestUserId || 'system',
              method: 'manual',
            },
            severity: 'medium',
          },
          { transaction: t }
        );
        
        return success(user.toJSON() as UserAttributes);
      } catch (err) {
        return failure({
          message: 'Error creating user record',
          statusCode: 500,
          code: ErrorCode.DATABASE_ERROR,
          originalError: err instanceof Error ? err : new Error('Unknown error'),
          source: 'userService.createUser'
        });
      }
    };
    
    // Execute the user creation workflow with Railway-Oriented Programming pattern
    try {
      // Check if user exists
      const existingUserResult = await checkExistingUser();
      if (!existingUserResult.ok) return existingUserResult;
      
      // Hash password
      const hashedPasswordResult = await prepareHashedPassword();
      if (!hashedPasswordResult.ok) return hashedPasswordResult;
      
      // Generate verification token
      const verificationResult = prepareVerificationToken();
      if (!verificationResult.ok) return verificationResult;
      
      // Create user with prepared data
      return createUserRecord(
        hashedPasswordResult.value, 
        verificationResult.value
      );
    } catch (err) {
      return failure({
        message: 'Error in user creation process',
        statusCode: 500,
        code: ErrorCode.INTERNAL_ERROR,
        originalError: err instanceof Error ? err : new Error('Unknown error'),
        source: 'userService.createUser'
      });
    }
  }, externalTransaction);
};

/**
 * Get a user by ID
 */
export const getUserById = async (
  id: string
): Promise<Result<UserAttributes>> => {
  try {
    const user = await db.User.findByPk(id, {
      attributes: { exclude: ['password'] },
    });
    
    if (!user) {
      return failure({
        message: 'User not found',
        statusCode: 404,
      });
    }
    
    return success(user.toJSON() as UserAttributes);
  } catch (err) {
    return failure({
      message: 'Error fetching user',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error'),
    });
  }
};

/**
 * Update a user with proper transaction handling and optimistic locking
 */
export const updateUser = async (
  id: string,
  params: UpdateUserParams,
  requestUserId?: string
): Promise<Result<UserAttributes>> => {
  // Using the withTransaction utility to handle transaction properly
  return withTransaction(async (t) => {
    try {
      // Find user with locking to prevent race conditions
      const user = await db.User.findByPk(id, { 
        transaction: t,
        lock: true // Use row-level locking to prevent concurrent updates
      });
      
      if (!user) {
        return failure({
          message: 'User not found',
          statusCode: 404,
          code: ErrorCode.RESOURCE_NOT_FOUND
        });
      }
      
      // Apply updates
      await user.update(params, { transaction: t });
      
      // Create audit log
      await db.SecurityAuditLog.create(
        {
          id: uuidv4(),
          userId: user.id,
          event: 'USER_UPDATED',
          details: {
            updatedBy: requestUserId || 'system',
            fields: Object.keys(params),
          },
          severity: 'low',
        },
        { transaction: t }
      );
      
      // Fetch updated user within the same transaction to ensure consistency
      const updatedUser = await db.User.findByPk(id, {
        attributes: { exclude: ['password'] },
        transaction: t
      });
      
      if (!updatedUser) {
        return failure({
          message: 'Error fetching updated user',
          statusCode: 500,
          code: ErrorCode.DATABASE_ERROR
        });
      }
      
      return success(updatedUser.toJSON() as UserAttributes);
    } catch (err) {
      return failure({
        message: 'Error updating user',
        statusCode: 500,
        code: ErrorCode.DATABASE_ERROR,
        originalError: err instanceof Error ? err : new Error('Unknown error'),
        source: 'userService.updateUser'
      });
    }
  });
};

/**
 * Building search query parameters using functional composition
 */

/**
 * Search for users with enhanced functional composition
 * 
 * This implementation uses our new functional composition patterns to break
 * down the search operation into discrete, composable steps.
 */
export const searchUsers = async (
  params: SearchUserParams
): Promise<Result<{
  users: UserAttributes[];
  total: number;
  page: number;
  totalPages: number;
}>> => {
  try {
    // Destructure parameters with defaults
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
      sortOrder = 'DESC',
    } = params;
    
    // Define pure function to build the base where condition
    const buildBaseCondition = (): Record<string, any> => {
      const where: Record<string, any> = {};
      
      if (status) where.status = status;
      if (tenant) where.tenantId = tenant;
      
      return where;
    };
    
    // Define pure function to add search query condition
    const addSearchCondition = (where: Record<string, any>): Record<string, any> => {
      if (query) {
        where[Op.or] = [
          { email: { [Op.iLike]: `%${query}%` } },
          { name: { [Op.iLike]: `%${query}%` } },
        ];
      }
      return where;
    };
    
    // Define pure function to add date range condition
    const addDateRangeCondition = (where: Record<string, any>): Record<string, any> => {
      if (lastLoginStart || lastLoginEnd) {
        where.lastLoginAt = {};
        if (lastLoginStart) where.lastLoginAt[Op.gte] = new Date(lastLoginStart);
        if (lastLoginEnd) where.lastLoginAt[Op.lte] = new Date(lastLoginEnd);
      }
      return where;
    };
    
    // Use function composition to build the complete where condition
    const whereCondition = compose<void, Record<string, any>>(
      addDateRangeCondition,
      addSearchCondition,
      buildBaseCondition
    )();
    
    // Build include options for role filtering
    const buildIncludeOptions = () => {
      const include = [];
      if (role) {
        include.push({
          model: db.Role,
          where: { name: role },
          through: { attributes: [] },
        });
      }
      return include;
    };
    
    // Execute query with composed conditions
    const findUsers = async () => {
      const options = {
        where: whereCondition,
        include: buildIncludeOptions(),
        order: [[sortBy, sortOrder]],
        limit,
        offset: (page - 1) * limit,
        attributes: { exclude: ['password'] },
      };
      
      try {
        const results = await db.User.findAndCountAll(options);
        return success(results);
      } catch (err) {
        return failure({
          message: 'Error executing user search query',
          statusCode: 500,
          code: ErrorCode.DATABASE_ERROR,
          originalError: err instanceof Error ? err : new Error('Unknown error')
        });
      }
    };
    
    // Transform query results to the expected format
    const formatResults = (results: any) => {
      const users = results.rows.map((user: any) => user.toJSON() as UserAttributes);
      const total = results.count;
      const totalPages = Math.ceil(total / limit);
      
      return {
        users,
        total,
        page,
        totalPages,
      };
    };
    
    // Execute the search and transform the results
    const results = await findUsers();
    return transformResult(results, formatResults);
  } catch (err) {
    return failure({
      message: 'Error searching users',
      statusCode: 500,
      code: ErrorCode.INTERNAL_ERROR,
      originalError: err instanceof Error ? err : new Error('Unknown error'),
    });
  }
};

/**
 * Change a user's password
 */
export const changePassword = async (
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<Result<void>> => {
  const t = await db.sequelize.transaction();
  
  try {
    const user = await db.User.findByPk(id, { transaction: t });
    
    if (!user) {
      await t.rollback();
      return failure({
        message: 'User not found',
        statusCode: 404,
      });
    }
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password as string);
    if (!validPassword) {
      await t.rollback();
      return failure({
        message: 'Invalid current password',
        statusCode: 401,
      });
    }
    
    // Hash new password
    const hashedPasswordResult = await hashPassword(newPassword);
    if (!hashedPasswordResult.ok) {
      await t.rollback();
      return hashedPasswordResult;
    }
    
    // Update password
    await user.update(
      { password: hashedPasswordResult.value },
      { transaction: t }
    );
    
    // Create audit log
    await db.SecurityAuditLog.create(
      {
        id: uuidv4(),
        userId: user.id,
        event: 'PASSWORD_CHANGED',
        details: {
          method: 'self',
        },
        severity: 'medium',
      },
      { transaction: t }
    );
    
    await t.commit();
    return success(undefined);
  } catch (err) {
    await t.rollback();
    return failure({
      message: 'Error changing password',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error'),
    });
  }
};
