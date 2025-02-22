const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticateHandler } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createRoleSchema, updateRoleSchema } = require('../validations/roleValidations');

// Role management routes
router.post('/', 
  authenticateHandler,
  validate(createRoleSchema),
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
  validate(updateRoleSchema),
  roleController.update
);

router.delete('/:id',
  authenticateHandler,
  roleController.delete
);

module.exports = router;
