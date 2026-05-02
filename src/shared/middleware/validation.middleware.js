import ValidationError from '../errors/ValidationError.js';

/**
 * Middleware to validate request data using Joi schemas
 * @param {Object} schema - Joi validation schema object
 * @returns {Function} Express middleware
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const validationOptions = {
      abortEarly: false,        // Return all errors, not just first one
      allowUnknown: true,       // Allow fields not in schema
      stripUnknown: true        // Remove unknown fields
    };

    const errors = {};

    // Validate body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, validationOptions);
      if (error) {
        errors.body = error.details.map(err => ({
          message: err.message,
          path: err.path
        }));
      } else {
        req.body = value; // Replace with validated/sanitized value
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, validationOptions);
      if (error) {
        errors.query = error.details.map(err => ({
          message: err.message,
          path: err.path
        }));
      } else {
        req.query = value;
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, validationOptions);
      if (error) {
        errors.params = error.details.map(err => ({
          message: err.message,
          path: err.path
        }));
      } else {
        req.params = value;
      }
    }

    // If there are validation errors, throw ValidationError
    if (Object.keys(errors).length > 0) {
      const errorMessage = Object.entries(errors)
        .map(([key, err]) => `${key}: ${err.map(e => e.message).join(', ')}`)
        .join(' | ');

      return next(new ValidationError(errorMessage));
    }

    next();
  };
};