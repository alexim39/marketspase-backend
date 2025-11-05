import { validateNameWithProfile } from './validate-name-with-profile.service.js';

export const getVerificationLevel = (user, accountNumber, accountName) => {
  /**
   * Determine the verification level for this withdrawal attempt
   */
  const savedAccount = user.savedAccounts.find(
    account => account.accountNumber === accountNumber
  );
  
  if (savedAccount?.verified) {
    return 'verified';
  } else if (savedAccount) {
    return 'saved';
  } else {
    const nameMatch = validateNameWithProfile(user, accountName);
    return nameMatch ? 'name_matched' : 'unverified';
  }
};