import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ControllerFunction } from '../types';
import * as userService from '../services/userService';
import { 
  handleServiceResult, 
  createController,
  getPaginationParams,
  getSortParams,
  buildSearchCondition,
  buildDateRangeCondition,
  combineConditions
} from '../utils/controller';
import { withTransactionChain, withTransaction } from '../utils/transactions';
import { success } from '../utils/errors';

/**
 * Get a user by ID
 */
const getUserHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const result = await userService.getUserById(id);
  handleServiceResult(result, res);
};

/**
 * Create a new user
 * 
 * This uses Zod validation to ensure input data is valid before processing.
 * It demonstrates our integrated functional validation approach.
 */
const createUserHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  // Import the validation tools and schema
  const { validateWithSchema } = await import('../utils/validation');
  const { createUserSchema } = await import('../validations/userValidations');
  
  // Validate request data using our Zod schema
  const validationResult = validateWithSchema(
    createUserSchema,
    req.body,
    'UserController.createUser'
  );
  
  // Return early if validation failed
  if (!validationResult.ok) {
    handleServiceResult(validationResult, res);
    return;
  }
  
  // Use the validated data to create the user
  const result = await userService.createUser(
    validationResult.value,
    req.user?.id
  );
  
  // Handle the result
  handleServiceResult(result, res, 201);
};

/**
 * Update an existing user
 */
const updateUserHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const result = await userService.updateUser(
    id,
    req.body,
    req.user?.id
  );
  handleServiceResult(result, res);
};

/**
 * Search users with filtering and pagination
 */
const searchUsersHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  // Extract query parameters using pure utility functions
  const pagination = getPaginationParams(req.query);
  const sorting = getSortParams(req.query);
  
  // Build search conditions using pure functions
  const searchCondition = buildSearchCondition(
    req.query.query as string, 
    ['email', 'name']
  );
  
  const statusCondition = req.query.status ? 
    { status: req.query.status as string } : 
    null;
  
  const dateCondition = buildDateRangeCondition(
    req.query.lastLoginStart as string,
    req.query.lastLoginEnd as string,
    'lastLoginAt'
  );
  
  // Combine all conditions
  const whereCondition = combineConditions(
    searchCondition,
    statusCondition,
    dateCondition
  );
  
  // Prepare search parameters
  const searchParams = {
    ...req.query,
    ...pagination,
    ...sorting,
    where: whereCondition
  };
  
  const result = await userService.searchUsers(searchParams);
  handleServiceResult(result, res);
};

/**
 * Change user password
 */
const changePasswordHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;
  
  const result = await userService.changePassword(
    id,
    currentPassword,
    newPassword
  );
  
  handleServiceResult(
    result, 
    res, 
    200, 
    () => ({ message: 'Password updated successfully' })
  );
};

/**
 * Create a user with roles and profile in a single transaction chain
 * 
 * This demonstrates the functional transaction pattern using withTransactionChain
 * to create a user, profile, and roles in a single atomic operation.
 */
const createUserWithProfileHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { userData, profileData, roles } = req.body;
  
  // Use the functional transaction chain to handle the entire operation as a unit
  const result = await withTransactionChain<{
    id: string;
    email: string;
    name: string;
    profile: any;
    roles: string[];
  }>(
    // Initial data
    { userData, profileData, roles, requestUserId: req.user?.id },
    
    // Chain of operations, each using the result of the previous step
    [
      // Step 1: Create the user
      (data, transaction) => userService.createUser(
        data.userData,
        data.requestUserId,
        transaction
      ),
      
      // Step 2: Update the user's profile with the user ID
      (user, transaction) => userService.updateUser(
        user.id,
        { profile: { ...profileData, userId: user.id } },
        req.user?.id,
        transaction
      ),
      
      // Step 3: Assign roles to the user
      (user, transaction) => {
        // This could be a call to a roleService function
        // For demo, we'll just return the user with roles
        return success({
          ...user,
          roles: roles || []
        });
      }
    ]
  );
  
  // Handle the result of the entire chain
  handleServiceResult(result, res, 201);
};

/**
 * User controller with wrapped error handling
 */
export default createController({
  getUser: getUserHandler,
  createUser: createUserHandler,
  updateUser: updateUserHandler,
  searchUsers: searchUsersHandler,
  changePassword: changePasswordHandler,
  createUserWithProfile: createUserWithProfileHandler
});

// Export individual functions for direct access if needed
export const getUser = getUserHandler;
export const createUser = createUserHandler;
export const updateUser = updateUserHandler;
export const searchUsers = searchUsersHandler;
export const changePassword = changePasswordHandler;
export const createUserWithProfile = createUserWithProfileHandler;
