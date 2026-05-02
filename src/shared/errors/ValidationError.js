import AppError from './AppError.js';

class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400);
  }
}
export default ValidationError;