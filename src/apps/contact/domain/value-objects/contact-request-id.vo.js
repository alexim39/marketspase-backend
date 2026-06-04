export class ContactRequestId {
  constructor(value) {
    if (!ContactRequestId.isValidNumeric(value)) {
      throw new Error("Contact request ID must be an 8 digit numeric string.");
    }

    this.value = value;
  }

  static generateNumeric(length = 8) {
    let result = "";
    for (let index = 0; index < length; index += 1) {
      result += Math.floor(Math.random() * 10);
    }

    return new ContactRequestId(result);
  }

  static isValidNumeric(value) {
    return typeof value === "string" && /^\d{8}$/.test(value);
  }

  toString() {
    return this.value;
  }
}
