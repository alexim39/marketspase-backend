// utils/asyncHandler.js

/**
 * Wrapper function to handle async errors in Express routes
 * Eliminates the need for try-catch blocks in controllers
 * 
 * @param {Function} requestHandler - Async controller function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next))
      .catch((error) => {
        // Log error for debugging (optional)
        console.error('Async Handler Error:', {
          message: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method,
          ip: req.ip,
          userId: req.user?._id
        });

        // Pass to Express error handler
        next(error);
      });
  };
};

/**
 * Alternative version with try-catch pattern
 * Some developers prefer this syntax
 */
const asyncHandlerTryCatch = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    // Ensure error is properly formatted
    if (!(error instanceof ApiError)) {
      // Convert unknown errors to ApiError
      error = new ApiError(
        error.statusCode || 500,
        error.message || "Internal Server Error",
        error.errors || [],
        error.stack
      );
    }
    
    next(error);
  }
};

export { asyncHandler, asyncHandlerTryCatch };