export class ContactResponsePresenter {
  static submitted({ contact }) {
    return {
      data: contact,
      success: true,
      message: "Request submitted successfully, you will hear from us soon",
    };
  }

  static authenticationRequired() {
    return {
      message: "Authentication required.",
      success: false,
    };
  }

  static userNotFound() {
    return {
      message: "User not found.",
      success: false,
    };
  }

  static internalServerError() {
    return {
      message: "internal server error",
      success: false,
    };
  }
}
