import { isNameComponentMatch } from './name-matching.service.js';


/**
 * --- Helper: Relaxed single-name matching ---
 */
export const relaxedSingleNameMatching = (userParts, accountParts) => {
  if (userParts.length === 0 || accountParts.length === 0) return false;
  if (userParts.length === 1 && accountParts.length === 1) {
    return isNameComponentMatch(userParts[0], accountParts[0]);
  }
  const singlePart = userParts.length === 1 ? userParts[0] : accountParts[0];
  const multiParts = userParts.length === 1 ? accountParts : userParts;
  return multiParts.some((part) => isNameComponentMatch(singlePart, part));
};


// Enhanced Name Matching Functions
export const validateNameWithProfile = (user, accountName) => {
  /**
   * Flexible name matching that checks for at least 2 name components
   * regardless of order or format differences
   */
  
  const userDisplayName = user.displayName?.toLowerCase() || '';
  const providedAccountName = accountName.toLowerCase();
  
  // If exact match, return true immediately
  if (userDisplayName === providedAccountName) {
    return true;
  }
  
  // Normalize names: remove extra spaces, punctuation, and standardize
  const normalizeName = (name) => {
    return name
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ')     // Collapse multiple spaces
      .trim()
      .toLowerCase();
  };
  
  const normalizedUserName = normalizeName(userDisplayName);
  const normalizedAccountName = normalizeName(providedAccountName);
  
  // Split into name components (words)
  const userNameParts = normalizedUserName.split(/\s+/).filter(part => part.length > 1);
  const accountNameParts = normalizedAccountName.split(/\s+/).filter(part => part.length > 1);
  
  // If either name has less than 2 parts, use relaxed matching
  if (userNameParts.length < 2 || accountNameParts.length < 2) {
    return relaxedSingleNameMatching(userNameParts, accountNameParts);
  }
  
  // Check for matching name components (minimum 2 matches required)
  const matchingParts = userNameParts.filter(userPart =>
    accountNameParts.some(accountPart => 
      isNameComponentMatch(userPart, accountPart)
    )
  );
  
  // Require at least 2 matching name components
  const hasSufficientMatch = matchingParts.length >= 2;
  
  // Additional check: if we have exactly 1 match, verify it's a substantial match
  if (matchingParts.length === 1) {
    const singleMatch = relaxedSingleNameMatching(userNameParts, accountNameParts);
    return singleMatch;
  }
  
  console.log(`Name matching: User "${normalizedUserName}" vs Account "${normalizedAccountName}" - Matches: ${matchingParts.length}`);
  
  return hasSufficientMatch;
};