// utils/ApiError.js

/**
 * Custom error class for API errors
 * Extends the native Error class with additional properties
 */
class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    stack = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Create a bad request error (400)
   */
  static badRequest(message = "Bad Request", errors = []) {
    return new ApiError(400, message, errors);
  }

  /**
   * Create an unauthorized error (401)
   */
  static unauthorized(message = "Unauthorized", errors = []) {
    return new ApiError(401, message, errors);
  }

  /**
   * Create a forbidden error (403)
   */
  static forbidden(message = "Forbidden", errors = []) {
    return new ApiError(403, message, errors);
  }

  /**
   * Create a not found error (404)
   */
  static notFound(message = "Resource not found", errors = []) {
    return new ApiError(404, message, errors);
  }

  /**
   * Create a conflict error (409)
   */
  static conflict(message = "Conflict", errors = []) {
    return new ApiError(409, message, errors);
  }

  /**
   * Create an internal server error (500)
   */
  static internal(message = "Internal Server Error", errors = []) {
    return new ApiError(500, message, errors);
  }

  /**
   * Create a validation error (422)
   */
  static validation(message = "Validation Error", errors = []) {
    return new ApiError(422, message, errors);
  }

  /**
   * Create a too many requests error (429)
   */
  static tooManyRequests(message = "Too Many Requests", errors = []) {
    return new ApiError(429, message, errors);
  }
}

export { ApiError };