export class ContactAuthenticationRequiredError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "ContactAuthenticationRequiredError";
  }
}

export class ContactUserNotFoundError extends Error {
  constructor(message = "User not found.") {
    super(message);
    this.name = "ContactUserNotFoundError";
  }
}

export class ContactInvalidIdError extends Error {
  constructor(message = "Invalid contact ID") {
    super(message);
    this.name = "ContactInvalidIdError";
  }
}

export class ContactNotFoundError extends Error {
  constructor(message = "Contact message not found") {
    super(message);
    this.name = "ContactNotFoundError";
  }
}

export class ContactInvalidArchiveValueError extends Error {
  constructor(message = "Archived must be a boolean value") {
    super(message);
    this.name = "ContactInvalidArchiveValueError";
  }
}

export class ContactInvalidPriorityValueError extends Error {
  constructor(message = "Invalid priority value") {
    super(message);
    this.name = "ContactInvalidPriorityValueError";
  }
}

export class ContactInvalidStatusValueError extends Error {
  constructor(message = "Invalid status value") {
    super(message);
    this.name = "ContactInvalidStatusValueError";
  }
}

export class ContactInvalidAdminIdError extends Error {
  constructor(message = "Invalid admin ID") {
    super(message);
    this.name = "ContactInvalidAdminIdError";
  }
}

export class ContactInvalidAdminUserError extends Error {
  constructor(message = "Invalid admin user") {
    super(message);
    this.name = "ContactInvalidAdminUserError";
  }
}

export class ContactAdminNoteRequiredError extends Error {
  constructor(message = "Note is required") {
    super(message);
    this.name = "ContactAdminNoteRequiredError";
  }
}

export class ContactInvalidTagsValueError extends Error {
  constructor(message = "Tags must be an array") {
    super(message);
    this.name = "ContactInvalidTagsValueError";
  }
}

export class ContactIdsRequiredError extends Error {
  constructor(message = "No contact IDs provided") {
    super(message);
    this.name = "ContactIdsRequiredError";
  }
}

export class ContactNoValidIdsError extends Error {
  constructor(message = "No valid contact IDs provided") {
    super(message);
    this.name = "ContactNoValidIdsError";
  }
}
