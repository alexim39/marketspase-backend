export class TutorialValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'TutorialValidationError';
    this.details = details;
  }
}

export class TutorialSectionNotFoundError extends Error {
  constructor(message = 'Section not found') {
    super(message);
    this.name = 'TutorialSectionNotFoundError';
  }
}

export class TutorialVideoNotFoundError extends Error {
  constructor(message = 'Video not found') {
    super(message);
    this.name = 'TutorialVideoNotFoundError';
  }
}

export class TutorialVideoAlreadyExistsError extends Error {
  constructor(message = 'Video already exists in this section') {
    super(message);
    this.name = 'TutorialVideoAlreadyExistsError';
  }
}
