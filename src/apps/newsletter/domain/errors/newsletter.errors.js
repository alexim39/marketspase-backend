export class NewsletterNotFoundError extends Error {
  constructor(message = "Newsletter not found") {
    super(message);
    this.name = "NewsletterNotFoundError";
  }
}

export class NewsletterActionRejectedError extends Error {
  constructor(message) {
    super(message);
    this.name = "NewsletterActionRejectedError";
  }
}
