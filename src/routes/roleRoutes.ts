import express, { Router } from 'express';
import { roleController } from '../controllers';
import { authenticateHandler, validate } from '../middleware';

/**
 * Create and configure role routes (factory function)
 */
const createRoleRouter = (): Router => {
  const router = express.Router();

  // Role management routes
  router.post('/', 
    authenticateHandler,
    // Will need to be replaced with the imported schema
    // validate(createRoleSchema),
    roleController.create
  );

  router.get('/',
    authenticateHandler,
    roleController.list
  );

  router.get('/:id',
    authenticateHandler,
    roleController.get
  );

  router.put('/:id',
    authenticateHandler,
    // Will need to be replaced with the imported schema
    // validate(updateRoleSchema),
    roleController.update
  );

  router.delete('/:id',
    authenticateHandler,
    roleController.delete
  );

  return router;
};

// Create and export the router
export default createRoleRouter();