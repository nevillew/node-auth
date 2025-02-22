const Joi = require('joi');

const getPasswordValidation = async (tenantId) => {
  const tenant = await Tenant.findByPk(tenantId);
  const policy = tenant?.securityPolicy?.password || {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventPasswordReuse: 3,
    expiryDays: 90
  };

  let pattern = '^';
  if (policy.requireLowercase) pattern += '(?=.*[a-z])';
  if (policy.requireUppercase) pattern += '(?=.*[A-Z])';
  if (policy.requireNumbers) pattern += '(?=.*\\d)';
  if (policy.requireSpecialChars) pattern += '(?=.*[@$!%*?&])';
  pattern += `.{${policy.minLength},}$`;

  return {
    pattern,
    policy
  };
};

const createUserSchema = async (tenantId) => Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    }),
  name: Joi.string().min(2).max(50).required(),
  avatar: Joi.string().uri().optional()
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  avatar: Joi.string().uri().allow('').optional(),
  profile: Joi.object({
    phoneNumber: Joi.string().pattern(/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/).optional(),
    address: Joi.string().max(200).optional(),
    timezone: Joi.string().valid(...Intl.supportedValuesOf('timeZone')).optional(),
    language: Joi.string().length(2).optional(),
    bio: Joi.string().max(500).optional(),
    socialLinks: Joi.object().pattern(Joi.string(), Joi.string().uri()).optional(),
    skills: Joi.array().items(Joi.string().max(50)).optional(),
    title: Joi.string().max(100).optional(),
    department: Joi.string().max(100).optional()
  }).optional(),
  preferences: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'system').optional(),
    notifications: Joi.object({
      email: Joi.boolean().optional(),
      push: Joi.boolean().optional(),
      sms: Joi.boolean().optional()
    }).optional(),
    accessibility: Joi.object({
      highContrast: Joi.boolean().optional(),
      fontSize: Joi.string().valid('small', 'normal', 'large').optional()
    }).optional(),
    privacy: Joi.object({
      profileVisibility: Joi.string().valid('public', 'private', 'connections').optional(),
      activityVisibility: Joi.string().valid('public', 'private', 'connections').optional()
    }).optional()
  }).optional(),
  emailPreferences: Joi.object({
    marketing: Joi.boolean().optional(),
    updates: Joi.boolean().optional(),
    security: Joi.boolean().optional(),
    newsletter: Joi.boolean().optional()
  }).optional()
}).min(1); // Require at least one field to update

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    })
});

const searchUserSchema = Joi.object({
  query: Joi.string().allow(''),
  status: Joi.string().valid('active', 'inactive', 'suspended'),
  role: Joi.string(),
  tenant: Joi.string().uuid(),
  lastLoginStart: Joi.date().iso(),
  lastLoginEnd: Joi.date().iso().min(Joi.ref('lastLoginStart')),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  sortBy: Joi.string().valid('createdAt', 'email', 'name', 'lastLoginAt'),
  sortOrder: Joi.string().valid('ASC', 'DESC')
});

const bulkUpdateSchema = Joi.object({
  userIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  updates: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'suspended'),
    roleIds: Joi.array().items(Joi.string().uuid()),
    permissionIds: Joi.array().items(Joi.string().uuid())
  }).required()
});

const statusUpdateSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'suspended').required(),
  reason: Joi.string().max(500)
});

const roleAssignmentSchema = Joi.object({
  roles: Joi.array().items(Joi.string().uuid()).min(1).required()
});

const permissionUpdateSchema = Joi.object({
  permissions: Joi.array().items(Joi.string().uuid()).min(1).required()
});

const deactivateSchema = Joi.object({
  reason: Joi.string().max(500).required()
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  searchUserSchema,
  bulkUpdateSchema,
  statusUpdateSchema,
  roleAssignmentSchema,
  permissionUpdateSchema,
  deactivateSchema
};
