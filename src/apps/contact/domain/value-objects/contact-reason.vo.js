import { CONTACT_REASONS_ARRAY } from "../contact.constants.js";

export class ContactReason {
  constructor(value) {
    if (!CONTACT_REASONS_ARRAY.includes(value)) {
      throw new Error("Invalid contact reason.");
    }

    this.value = value;
  }

  toString() {
    return this.value;
  }
}
