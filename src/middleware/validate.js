const Joi = require('joi');
const { AppError } = require('./errorHandler');

const Joi = require('joi');
const { AppError } = require('./errorHandler');

const validate = (schema, location = 'body') => {
  return (req, res, next) => {
    const options = {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    };

    const dataToValidate = location === 'all' 
      ? {
          body: req.body,
          query: req.query,
          params: req.params
        }
      : req[location];

    const { error, value } = schema.validate(dataToValidate, options);

    if (error) {
      const errorMessage = error.details
        .map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }));
      
      return next(new AppError('VALIDATION_ERROR', 400, errorMessage));
    }

    // Replace validated data
    if (location === 'all') {
      req.body = value.body;
      req.query = value.query;
      req.params = value.params;
    } else {
      req[location] = value;
    }

    next();
  };
};

// Common validation schemas
const commonSchemas = {
  uuid: Joi.string().uuid(),
  email: Joi.string().email(),
  password: Joi.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC')
  })
};

module.exports = {
  validate,
  commonSchemas
};
