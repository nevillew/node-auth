import { Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

// Import models and types
import { Role, User, UserRole } from '../models';
import { RoleAttributes } from '../types';
import logger from '../config/logger';
import * as notificationService from './notificationService';

// Import utility functions
import { 
  Result, 
  success, 
  failure,
  withTransaction,
  findById,
  findAll,
  logSecurityEvent
} from '../utils';

// Types for role service
interface AssignRolesParams {
  userId: string;
  roleIds: string[];
  assignedBy: string;
}

/**
 * Check if removing admin role and user is last admin
 */
const checkLastAdmin = async (
  currentRoles: any[],
  roleIds: string[],
  transaction?: Transaction
): Promise<Result<void>> => {
  const adminRole = currentRoles.find(r => r.name === 'admin');
  
  if (!adminRole) {
    return success(undefined);
  }

  const isLosingAdmin = !roleIds.includes(adminRole.id);
  
  if (isLosingAdmin) {
    try {
      const adminCount = await UserRole.count({
        where: { roleId: adminRole.id },
        transaction
      });

      if (adminCount === 1) {
        return failure({
          message: 'Cannot remove last admin role',
          statusCode: 400
        });
      }
      
      return success(undefined);
    } catch (err) {
      logger.error('Error checking admin roles:', { error: err });
      return failure({
        message: 'Error checking admin roles',
        statusCode: 500,
        originalError: err instanceof Error ? err : new Error('Unknown error')
      });
    }
  }

  return success(undefined);
};

/**
 * Assign roles to a user
 */
export const assignRolesToUser = async (
  params: AssignRolesParams,
  transaction?: Transaction
): Promise<Result<RoleAttributes[]>> => {
  return withTransaction(async (t) => {
    const { userId, roleIds, assignedBy } = params;
    
    // Find user with current roles
    const userResult = await findById(User, userId, {
      include: [Role],
      transaction: t,
      errorMessage: 'User not found'
    });
    
    if (!userResult.ok) {
      return userResult;
    }
    
    const user = userResult.value;
    
    // Get all requested roles
    const rolesResult = await findAll(Role, {
      where: { id: roleIds },
      transaction: t
    });
    
    if (!rolesResult.ok) {
      return rolesResult;
    }
    
    const roles = rolesResult.value;
    
    // Verify all roles exist
    if (roles.length !== roleIds.length) {
      return failure({
        message: 'One or more roles not found',
        statusCode: 400
      });
    }
    
    // Check if removing admin role and user is last admin
    const adminCheckResult = await checkLastAdmin(user.Roles, roleIds, t);
    if (!adminCheckResult.ok) {
      return adminCheckResult;
    }
    
    try {
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
      const auditResult = await logSecurityEvent(
        'ROLES_ASSIGNED',
        assignedBy,
        {
          targetUserId: userId,
          previousRoles: user.Roles.map(r => ({ id: r.id, name: r.name })),
          newRoles: roles.map(r => ({ id: r.id, name: r.name }))
        },
        'medium',
        t
      );
      
      if (!auditResult.ok) {
        return auditResult;
      }
      
      // Notify user (best effort, don't fail if notification fails)
      try {
        await notificationService.sendSystemNotification(
          userId,
          `Your roles have been updated by ${assignedBy}`
        );
      } catch (error) {
        logger.error('Failed to send role update notification', { error });
      }
      
      return success(roles.map(role => role.toJSON()) as RoleAttributes[]);
    } catch (err) {
      logger.error('Role assignment failed:', { error: err });
      return failure({
        message: 'Error assigning roles',
        statusCode: 500,
        originalError: err instanceof Error ? err : new Error('Unknown error')
      });
    }
  }, transaction);
};

/**
 * Get roles for a user
 */
export const getUserRoles = async (
  userId: string
): Promise<Result<RoleAttributes[]>> => {
  const userResult = await findById(User, userId, {
    include: [{
      model: Role,
      through: { attributes: [] }
    }],
    errorMessage: 'User not found'
  });
  
  if (!userResult.ok) {
    return userResult;
  }
  
  const user = userResult.value;
  return success(user.Roles.map(role => role.toJSON()) as RoleAttributes[]);
};