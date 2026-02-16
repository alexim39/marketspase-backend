// utils/ApiResponse.js

/**
 * Standard API response formatter
 * Ensures consistent response structure across all endpoints
 */
class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }

  /**
   * Send the response
   * @param {Object} res - Express response object
   */
  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create a success response (200)
   */
  static success(data, message = "Success") {
    return new ApiResponse(200, data, message);
  }

  /**
   * Create a created response (201)
   */
  static created(data, message = "Resource created successfully") {
    return new ApiResponse(201, data, message);
  }

  /**
   * Create an accepted response (202)
   */
  static accepted(data, message = "Request accepted") {
    return new ApiResponse(202, data, message);
  }

  /**
   * Create a no content response (204)
   */
  static noContent(message = "No content") {
    return new ApiResponse(204, null, message);
  }

  /**
   * Create a paginated response
   */
  static paginated(data, pagination, message = "Success") {
    return new ApiResponse(200, {
      items: data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: pagination.pages,
        hasNext: pagination.page < pagination.pages,
        hasPrev: pagination.page > 1
      }
    }, message);
  }
}

export { ApiResponse };