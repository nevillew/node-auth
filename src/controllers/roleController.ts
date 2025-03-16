import { Response } from 'express';
import { Role, Permission, RolePermission, User, SecurityAuditLog, Op, sequelize, UserRole } from '../models';
import logger from '../config/logger';
import { AuthenticatedRequest, ControllerFunction } from '../types';
import { 
  Result, 
  success, 
  failure, 
  fromPromise, 
  mapResult,
  chainResult
} from '../utils/errors';
import { 
  handleServiceResult, 
  createController,
  getPaginationParams,
  getSortParams,
  buildSearchCondition,
  formatPaginatedResponse
} from '../utils/controller';
import { notificationService } from '../services';

// Type definitions
interface RoleCreateParams {
  name: string;
  description: string;
  scopes: string[];
  permissions?: string[];
}

interface RoleUpdateParams {
  name?: string;
  description?: string;
  scopes?: string[];
  permissions?: string[];
}

interface RoleDeleteParams {
  confirm?: boolean;
}

interface RoleFilters {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
  isDefault?: boolean;
}

// Pure functions for role operations

/**
 * Check if a role name already exists for a tenant (pure async function)
 */
export const checkRoleNameExists = async (
  name: string,
  tenantId: string,
  excludeRoleId?: string,
  transaction?: any
): Promise<Result<boolean>> => {
  try {
    const whereClause = { name, tenantId };
    
    if (excludeRoleId) {
      whereClause['id'] = { [Op.ne]: excludeRoleId };
    }
    
    const existingRole = await Role.findOne({
      where: whereClause,
      transaction
    });
    
    return success(!!existingRole);
  } catch (error) {
    logger.error('Error checking role name:', error);
    return failure({
      message: 'Database error while checking role name',
      statusCode: 500,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * Format a role object for response (pure function)
 */
export const formatRoleResponse = (
  role: any,
  includeUsers = false
): Record<string, any> => {
  const formatted: Record<string, any> = {
    id: role.id,
    name: role.name,
    description: role.description,
    scopes: role.scopes,
    isDefault: role.isDefault,
    permissions: role.Permissions || [],
    userCount: role.Users?.length || 0,
    createdAt: role.createdAt
  };
  
  if (includeUsers && role.Users) {
    formatted['users'] = role.Users.map((user: any) => ({
      id: user.id,
      email: user.email,
      name: user.name
    }));
  }
  
  return formatted;
};

/**
 * Track changes to a role for auditing (pure function)
 */
export const trackRoleChanges = (
  original: { name: string; description: string; scopes: string[] },
  updates: RoleUpdateParams
): Record<string, any> => {
  const changes: Record<string, any> = {};
  
  if (updates.name && updates.name !== original.name) {
    changes.name = { from: original.name, to: updates.name };
  }
  
  if (updates.description && updates.description !== original.description) {
    changes.description = { from: original.description, to: updates.description };
  }
  
  if (updates.scopes) {
    changes.scopes = { from: original.scopes, to: updates.scopes };
  }
  
  return changes;
};

/**
 * Track permission changes (pure function)
 */
export const trackPermissionChanges = (
  currentPermissions: string[],
  newPermissions: string[]
): { added: string[], removed: string[] } => {
  return {
    added: newPermissions.filter(p => !currentPermissions.includes(p)),
    removed: currentPermissions.filter(p => !newPermissions.includes(p))
  };
};

/**
 * Create role with transaction (pure function with side effects isolated)
 */
const createRoleWithTransaction = async (
  params: RoleCreateParams,
  userId: string,
  tenantId: string
): Promise<Result<any>> => {
  const t = await sequelize.transaction();

  try {
    const { name, description, scopes, permissions } = params;

    // Check for duplicate role name
    const nameExistsResult = await checkRoleNameExists(name, tenantId, undefined, t);
    if (!nameExistsResult.ok) {
      await t.rollback();
      return nameExistsResult;
    }

    if (nameExistsResult.value) {
      await t.rollback();
      return failure({
        message: 'Role with this name already exists',
        statusCode: 409
      });
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
      userId,
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

    return success(createdRole);
  } catch (error) {
    await t.rollback();
    logger.error('Role creation failed:', error);
    
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      statusCode: error instanceof Error && error.name === 'SequelizeValidationError' ? 400 : 500,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * Update role with transaction (pure function with side effects isolated)
 */
const updateRoleWithTransaction = async (
  roleId: string,
  params: RoleUpdateParams,
  userId: string
): Promise<Result<any>> => {
  const t = await sequelize.transaction();
  
  try {
    const { name, description, scopes, permissions } = params;
    
    // Find role with users and permissions
    const role = await Role.findByPk(roleId, { 
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
      return failure({
        message: 'Role not found',
        statusCode: 404
      });
    }

    // Check if user has permission to modify this role
    if (role.isDefault && !role.hasScope('admin')) {
      await t.rollback();
      return failure({
        message: 'Cannot modify default role without admin scope',
        statusCode: 403
      });
    }

    // Check for duplicate name if name is being changed
    if (name && name !== role.name) {
      const nameExistsResult = await checkRoleNameExists(name, role.tenantId, role.id, t);
      
      if (!nameExistsResult.ok) {
        await t.rollback();
        return nameExistsResult;
      }
      
      if (nameExistsResult.value) {
        await t.rollback();
        return failure({
          message: 'Role with this name already exists',
          statusCode: 409
        });
      }
    }

    // Track changes for audit
    const changes = trackRoleChanges(role, {
      name, description, scopes
    });

    // Update role
    await role.update({
      name: name || role.name,
      description: description || role.description,
      scopes: scopes || role.scopes
    }, { transaction: t });

    // Update permissions if provided
    if (permissions) {
      const currentPermissions = role.Permissions.map(p => p.id);
      
      // Track permission changes
      changes.permissions = trackPermissionChanges(
        currentPermissions,
        permissions
      );

      // Remove existing permissions
      await RolePermission.destroy({
        where: { roleId: role.id },
        transaction: t
      });

      // Add new permissions
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
      userId,
      event: 'ROLE_UPDATED',
      details: {
        roleId: role.id,
        changes,
        affectedUsers: role.Users.length
      },
      severity: 'medium'
    }, { transaction: t });

    // Notify affected users (outside of transaction to prevent issues if notifications fail)
    const usersToNotify = [...role.Users];
    
    await t.commit();
    
    // Send notifications after transaction is committed
    await Promise.all(usersToNotify.map(user => 
      notificationService.sendSystemNotification(
        user.id,
        `The role "${role.name}" has been updated by ${userId ? 'an administrator' : 'the system'}`
      )
    ));

    // Fetch updated role with permissions
    const updatedRole = await Role.findByPk(role.id, {
      include: [Permission]
    });

    return success(updatedRole);
  } catch (error) {
    await t.rollback();
    logger.error('Role update failed:', error);
    
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      statusCode: error instanceof Error && error.name === 'SequelizeValidationError' ? 400 : 500,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * Delete role with transaction (pure function with side effects isolated)
 */
const deleteRoleWithTransaction = async (
  roleId: string,
  params: RoleDeleteParams,
  userId: string
): Promise<Result<void>> => {
  const t = await sequelize.transaction();
  
  try {
    const { confirm = false } = params;
    
    // Find role with users and permissions
    const role = await Role.findByPk(roleId, {
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
      return failure({
        message: 'Role not found',
        statusCode: 404
      });
    }

    if (role.isDefault) {
      await t.rollback();
      return failure({
        message: 'Cannot delete default role',
        statusCode: 400
      });
    }

    // Check if role has any users
    if (role.Users.length > 0 && !confirm) {
      await t.rollback();
      return failure({
        message: 'Role has assigned users',
        statusCode: 409,
        details: {
          requiresConfirmation: true,
          affectedUsers: role.Users.length,
          users: role.Users.map(u => ({
            id: u.id,
            email: u.email,
            name: u.name
          }))
        }
      });
    }

    // Store users for notification (after transaction succeeds)
    const usersToNotify = [...role.Users];
    const roleName = role.name;

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
      userId,
      event: 'ROLE_DELETED',
      details: {
        roleId: role.id,
        name: roleName,
        permissions: role.Permissions.map(p => p.name),
        affectedUsers: usersToNotify.length
      },
      severity: 'high'
    }, { transaction: t });

    await t.commit();
    
    // Notify affected users after transaction committed
    await Promise.all(usersToNotify.map(user =>
      notificationService.sendSystemNotification(
        user.id,
        `The role "${roleName}" you were assigned to has been deleted by ${userId ? 'an administrator' : 'the system'}`
      )
    ));

    return success(undefined);
  } catch (error) {
    await t.rollback();
    logger.error('Role deletion failed:', error);
    
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      statusCode: error instanceof Error && error.name === 'SequelizeValidationError' ? 400 : 500,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * List roles with filtering (pure function)
 */
const listRolesLogic = async (
  filters: RoleFilters, 
  tenantId: string
): Promise<Result<{ roles: any[], total: number, page: number, totalPages: number }>> => {
  try {
    if (!tenantId) {
      return failure({
        message: 'Tenant ID is required',
        statusCode: 400
      });
    }

    const {
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'ASC',
      search,
      isDefault
    } = filters;

    const where: any = { tenantId };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (isDefault !== undefined) {
      where.isDefault = isDefault;
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
      limit: parseInt(limit.toString()),
      offset: (parseInt(page.toString()) - 1) * parseInt(limit.toString()),
      distinct: true
    });

    return success({
      roles: roles.rows.map(role => formatRoleResponse(role)),
      total: roles.count,
      page: parseInt(page.toString()),
      totalPages: Math.ceil(roles.count / parseInt(limit.toString()))
    });
  } catch (error) {
    logger.error('Role listing failed:', error);
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      statusCode: 500,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * Get a role by ID (pure function)
 */
const getRoleById = async (
  roleId: string
): Promise<Result<any>> => {
  try {
    const role = await Role.findByPk(roleId, {
      include: [
        {
          model: Permission,
          through: { attributes: [] }
        },
        {
          model: User,
          attributes: ['id', 'email', 'name'],
          through: { attributes: [] }
        }
      ]
    });

    if (!role) {
      return failure({
        message: 'Role not found',
        statusCode: 404
      });
    }

    return success(role);
  } catch (error) {
    logger.error('Role retrieval failed:', error);
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      statusCode: 500,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

// Controller handler functions that use the pure function logic

/**
 * Create role handler
 */
const createRoleHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const params = req.body as RoleCreateParams;
  const userId = req.user?.id;
  const tenantId = req.tenant?.id;

  if (!tenantId) {
    res.status(400).json({ error: 'Tenant ID is required' });
    return;
  }

  const result = await createRoleWithTransaction(params, userId, tenantId);
  handleServiceResult(result, res, 201, formatRoleResponse);
};

/**
 * Update role handler
 */
const updateRoleHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const roleId = req.params.id;
  const params = req.body as RoleUpdateParams;
  const userId = req.user?.id;

  const result = await updateRoleWithTransaction(roleId, params, userId);
  handleServiceResult(result, res, 200, formatRoleResponse);
};

/**
 * Delete role handler
 */
const deleteRoleHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const roleId = req.params.id;
  const params = req.body as RoleDeleteParams;
  const userId = req.user?.id;

  const result = await deleteRoleWithTransaction(roleId, params, userId);
  handleServiceResult(result, res, 204);
};

/**
 * List roles handler
 */
const listRolesHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const pagination = getPaginationParams(req.query);
  const sorting = getSortParams(req.query, 'name', 'ASC');
  
  const filters: RoleFilters = {
    ...pagination,
    ...sorting,
    search: req.query.search as string,
    isDefault: req.query.isDefault !== undefined ? 
      req.query.isDefault === 'true' : 
      undefined
  };

  const result = await listRolesLogic(filters, req.tenant?.id);
  handleServiceResult(result, res);
};

/**
 * Get role handler
 */
const getRoleHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const roleId = req.params.id;
  const result = await getRoleById(roleId);
  handleServiceResult(result, res, 200, role => formatRoleResponse(role, true));
};

// Export the controller with error handling wrapper
export default createController({
  createRole: createRoleHandler,
  updateRole: updateRoleHandler,
  deleteRole: deleteRoleHandler,
  listRoles: listRolesHandler,
  getRole: getRoleHandler
});

// Export individual handlers for direct access if needed
export const createRole = createRoleHandler;
export const updateRole = updateRoleHandler;
export const deleteRole = deleteRoleHandler;
export const listRoles = listRolesHandler;
export const getRole = getRoleHandler;
