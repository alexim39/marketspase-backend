/* import crypto from "crypto";

const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const generateUniqueUpi = () => {
  // Take last 5 digits of timestamp (time-based uniqueness)
  const timePart = Date.now().toString().slice(-5);

  // Generate 3 random base36 characters
  let randomPart = "";
  for (let i = 0; i < 3; i++) {
    randomPart += BASE36[crypto.randomInt(0, BASE36.length)];
  }

  // Convert timePart to base36 and pad to 5 chars
  const timeBase36 = parseInt(timePart, 10).toString(36).toUpperCase().padStart(5, "0");

  return `${timeBase36}${randomPart}`; // 8 characters
};
 */


import crypto from "crypto";

// Defined character set: Uppercase, Lowercase, and Numbers (62 chars)
const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const generateUniqueUpi = () => {
  let result = "";
  // Generate 10 random characters
  for (let i = 0; i < 10; i++) {
    const randomIndex = crypto.randomInt(0, CHARS.length);
    result += CHARS[randomIndex];
  }
  return result;
};

// Example usage:
// console.log(`https://marketspase.com{generateUniqueUpi()}`);
