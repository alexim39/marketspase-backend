import { UserModel } from "../../user/models/user.model.js";

/** * Generate a unique username for a user upon sign-up, regardless of the authentication method.
 *
 * @param {string} displayName - The full display name from the social provider (e.g., "Alex Imenwo", "Jane Doe").
 * @returns {Promise<string>} - A unique username.
 */
export const generateUniqueUsername = async (displayName) => {
  // 1. Basic input validation
  if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
    // You could throw an error, or in a more robust system, fall back to a generic username.
    // For this case, we'll throw an error as it indicates a a data issue from the provider.
    throw new Error("Display name is required to generate a username.");
  }

  // 2. Normalize and split the display name
  // The goal is to handle various name formats (e.g., "Alex", "Alex Imenwo", "Dr. Alex Imenwo Jr.")
  const nameParts = displayName.trim().toLowerCase().split(/\s+/);

  // 3. Create a base username
  let baseUsername;
  if (nameParts.length > 1) {
    // If there's more than one part, use the first letter of the first name and the last name.
    // Example: "Alex Imenwo" -> "aimenwo"
    baseUsername = nameParts[0].charAt(0) + nameParts[nameParts.length - 1];
  } else {
    // If there's only one part (e.g., "alex"), use that as the base.
    baseUsername = nameParts[0];
  }
  
  // Clean the username of any non-alphanumeric characters, except for a possible underscore or dash
  baseUsername = baseUsername.replace(/[^a-z0-9]/g, '');

  let candidateUsername = baseUsername;
  let counter = 1;

  // 4. Check for uniqueness and append a counter if needed
  while (true) {
    const existingUser = await UserModel.findOne({ username: candidateUsername }).exec();
    
    // If no user exists with this username, we've found a unique one.
    if (!existingUser) {
      return candidateUsername;
    }
    
    // If the username exists, append a counter and try again.
    candidateUsername = `${baseUsername}${counter++}`;
  }
};