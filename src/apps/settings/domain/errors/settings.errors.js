export class SettingsValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SettingsValidationError";
    this.details = details;
  }
}

export class SettingsUserNotFoundError extends Error {
  constructor(message = "User not found") {
    super(message);
    this.name = "SettingsUserNotFoundError";
  }
}

export class SettingsTestimonialNotFoundError extends Error {
  constructor(message = "Testimonial not found") {
    super(message);
    this.name = "SettingsTestimonialNotFoundError";
  }
}
