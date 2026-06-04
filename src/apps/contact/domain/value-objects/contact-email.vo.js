import { CONTACT_EMAIL_PATTERN } from "../contact.constants.js";

export class ContactEmail {
  constructor(value) {
    if (!value || !CONTACT_EMAIL_PATTERN.test(value)) {
      throw new Error("Invalid contact email.");
    }

    this.value = value;
  }

  toString() {
    return this.value;
  }
}
