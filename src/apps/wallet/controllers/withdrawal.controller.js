import { UserModel } from '../../user/models/user.model.js';
import { sendEmail } from "../../../services/emailService.js";
import { ownerWalletEmailTemplate } from '../services/email/ownerTemplate.js';
import { userWalletEmailTemplate } from '../services/email/userTemplate.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
import { processPayment } from '../services/process-payment.js';


// Enhanced Name Matching Functions
const validateNameWithProfile = (user, accountName) => {
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

const isNameComponentMatch = (part1, part2) => {
  /**
   * Check if two name components match, with flexibility for:
   * - Exact match
   * - Contains match (one contains the other)
   * - Initial match
   * - Common variations
   */
  
  // Exact match
  if (part1 === part2) return true;
  
  // One contains the other (useful for full name vs abbreviated)
  if (part1.includes(part2) || part2.includes(part1)) return true;
  
  // Initial match (J vs John, M vs Michael)
  if (part1.length === 1 && part2.startsWith(part1)) return true;
  if (part2.length === 1 && part1.startsWith(part2)) return true;
  
  // Common name variations dictionary
  const nameVariations = {
    'john': ['jon', 'johnny', 'jonathan'],
    'michael': ['mike', 'mikey', 'mich'],
    'robert': ['rob', 'bob', 'roberto'],
    'richard': ['rick', 'dick', 'rich'],
    'william': ['will', 'bill', 'billy'],
    'jennifer': ['jen', 'jenn', 'jenny'],
    'elizabeth': ['liz', 'beth', 'liza', 'eliza'],
    'katherine': ['kate', 'katie', 'catherine', 'cat'],
    'christopher': ['chris', 'topher'],
    'matthew': ['matt', 'mat'],
    'joseph': ['joe', 'joey'],
    'daniel': ['dan', 'danny'],
    'anthony': ['tony', 'ant'],
    'samuel': ['sam', 'sammie'],
    'andrew': ['andy', 'drew'],
    'theodore': ['ted', 'teddy', 'theo'],
    'nicholas': ['nick', 'nico'],
    'alexander': ['alex', 'xander'],
    'benjamin': ['ben', 'benny'],
    'jonathan': ['jon', 'john', 'nathan']
  };
  
  // Check variations
  const variations1 = nameVariations[part1] || [];
  const variations2 = nameVariations[part2] || [];
  
  if (variations1.includes(part2) || variations2.includes(part1)) return true;
  
  // Levenshtein distance for similar names (typo tolerance)
  if (calculateSimilarity(part1, part2) > 0.8) return true;
  
  return false;
};

const relaxedSingleNameMatching = (userParts, accountParts) => {
  /**
   * Handle cases where names have only 1-2 components
   */
  if (userParts.length === 0 || accountParts.length === 0) return false;
  
  // If both have only one part, check if they match reasonably
  if (userParts.length === 1 && accountParts.length === 1) {
    return isNameComponentMatch(userParts[0], accountParts[0]);
  }
  
  // If one name has multiple parts but the other has only one,
  // check if the single part matches any of the multiple parts
  const singlePart = userParts.length === 1 ? userParts[0] : accountParts[0];
  const multiParts = userParts.length === 1 ? accountParts : userParts;
  
  return multiParts.some(part => isNameComponentMatch(singlePart, part));
};

const calculateSimilarity = (str1, str2) => {
  /**
   * Calculate similarity between two strings (0-1)
   */
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

const levenshteinDistance = (str1, str2) => {
  /**
   * Calculate Levenshtein distance between two strings
   */
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i-1) === str1.charAt(j-1)) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

const validateAccountOwnership = (user, accountNumber, accountName) => {
  /**
   * Validate that the bank account belongs to the user making the request
   */
  
  // Check if this is a saved and verified account
  const savedAccount = user.savedAccounts.find(
    account => account.accountNumber === accountNumber
  );
  
  if (savedAccount) {
    // If account is already saved and verified, trust it
    if (savedAccount.verified) {
      console.log(`Using pre-verified account: ${accountNumber}`);
      return true;
    }
    
    // If saved but not verified, check name match
    const isNameMatch = validateNameWithProfile(user, accountName);
    console.log(`Saved account name match result: ${isNameMatch}`);
    return isNameMatch;
  }
  
  // For new accounts, perform name validation
  const isNameMatch = validateNameWithProfile(user, accountName);
  console.log(`New account name match result: ${isNameMatch}`);
  
  return isNameMatch;
};

const requireAccountVerification = (amount, isNewAccount) => {
  /**
   * Determine if additional verification is required based on amount and account status
   */
  const HIGH_AMOUNT_THRESHOLD = 50000;
  return amount > HIGH_AMOUNT_THRESHOLD || isNewAccount;
};

const getVerificationLevel = (user, accountNumber, accountName) => {
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

// User withdrawal request
export const withdrawRequest = async (req, res) => {
    const { bank, accountNumber, accountName, amount, userId, saveAccount, bankName } = req.body;

    // Use a single session for the entire operation to ensure atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // --- 1. Input and User Validation ---
        if (!userId || !amount || !bank || !accountNumber || !accountName) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Missing required fields: userId, amount, bank, accountNumber, and accountName are all required.",
                success: false,
                code: "MISSING_REQUIRED_FIELDS"
            });
        }

        const withdrawalAmount = Number(amount);
        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Invalid withdrawal amount. Amount must be a positive number.",
                success: false,
                code: "INVALID_AMOUNT"
            });
        }
        
        // Find the user by ID within the transaction
        const user = await UserModel.findById(userId).session(session);

        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({
                message: "User not found",
                success: false,
                code: "USER_NOT_FOUND"
            });
        }

        if (!user.isActive || user.isDeleted) {
            await session.abortTransaction();
            return res.status(403).json({
                message: "Account is inactive or deleted. Please contact support.",
                success: false,
                code: "ACCOUNT_INACTIVE"
            });
        }

        // --- SECURITY CHECK: Enhanced Account Ownership Validation ---
        const verificationLevel = getVerificationLevel(user, accountNumber, accountName);
        
        if (verificationLevel === 'unverified') {
            await session.abortTransaction();
            return res.status(403).json({
                message: "Account ownership verification failed. The account name must match your registered name. Please ensure you're using your own bank account.",
                success: false,
                code: "ACCOUNT_OWNERSHIP_VERIFICATION_FAILED",
                details: {
                    userDisplayName: user.displayName,
                    providedAccountName: accountName,
                    suggestion: "Please use a bank account that matches your registered name exactly or contact support for assistance."
                }
            });
        }

        // Check if this is a new account (not saved previously)
        const isNewAccount = !user.savedAccounts.some(
            account => account.accountNumber === accountNumber
        );

        // Additional verification for high amounts or new accounts
        const requiresAdditionalVerification = requireAccountVerification(withdrawalAmount, isNewAccount);
        
        if (requiresAdditionalVerification) {
            console.log(`Additional verification recommended for withdrawal: ${withdrawalAmount} to ${isNewAccount ? 'new' : 'existing'} account`);
            // In a production system, you might:
            // - Send OTP verification
            // - Require admin approval
            // - Limit the withdrawal amount
        }
        
        const promoterWallet = user.wallets.promoter;

        // --- 2. Calculate Fee and Total Deduction ---
        const WITHDRAWAL_FEE_RATE = 0.015;
        const WITHDRAWAL_FLAT_FEE = 100;
        const withdrawalFee = Math.max(withdrawalAmount * WITHDRAWAL_FEE_RATE, WITHDRAWAL_FLAT_FEE);
        const totalDeduction = withdrawalAmount + withdrawalFee;

        // Check for sufficient balance
        if (promoterWallet.balance < totalDeduction) {
            await session.abortTransaction();
            return res.status(400).json({
                message: `Insufficient balance. You need ₦${totalDeduction.toLocaleString()} (₦${withdrawalAmount.toLocaleString()} + ₦${withdrawalFee.toLocaleString()} fee) but only have ₦${promoterWallet.balance.toLocaleString()} available.`,
                success: false,
                code: "INSUFFICIENT_BALANCE",
                data: {
                    availableBalance: promoterWallet.balance,
                    requiredAmount: totalDeduction,
                    withdrawalAmount: withdrawalAmount,
                    fee: withdrawalFee
                }
            });
        }

        // --- 3. Initial State Change (Deduction & Pending Transaction) ---
        promoterWallet.balance -= totalDeduction;
        
        // Create a new pending transaction record
        const newTransaction = {
            amount: withdrawalAmount,
            fee: withdrawalFee,
            totalDeduction: totalDeduction,
            type: 'debit',
            category: 'withdrawal',
            description: `Withdrawal to ${bankName} account ending in ${accountNumber.slice(-4)}`,
            status: 'pending',
            createdAt: new Date(),
            securityFlags: {
                accountVerified: verificationLevel !== 'unverified',
                verificationLevel: verificationLevel,
                isNewAccount: isNewAccount,
                requiresAdditionalVerification: requiresAdditionalVerification,
                nameMatchDetails: {
                    userDisplayName: user.displayName,
                    providedAccountName: accountName
                }
            }
        };
        promoterWallet.transactions.push(newTransaction);
        
        // --- 4. Process External Payment ---
        const paymentResponse = await processPayment(bank, accountNumber, accountName, withdrawalAmount);

        // --- 5. Update Database based on Payment Response ---
        const transactionToUpdate = promoterWallet.transactions[promoterWallet.transactions.length - 1];
        
        if (paymentResponse.success) {
            // Update transaction status
            transactionToUpdate.status = "successful";
            transactionToUpdate.processedAt = new Date();
            transactionToUpdate.reference = paymentResponse.reference;
            
            // Add account to saved accounts if requested and verified
            if (saveAccount && verificationLevel !== 'unverified') {
                const existingAccount = user.savedAccounts.find(
                    account => account.accountNumber === accountNumber
                );

                if (!existingAccount) {
                    user.savedAccounts.push({
                        bank: bankName,
                        bankCode: bank,
                        accountNumber: accountNumber,
                        accountName: accountName,
                        verified: true,
                        verifiedAt: new Date(),
                        firstUsed: new Date(),
                        lastUsed: new Date()
                    });
                } else {
                    // Update last used timestamp for existing account
                    existingAccount.lastUsed = new Date();
                }
            }

            await user.save({ session });
            await session.commitTransaction();
            
            // Send notification email
            try {
                await sendEmail({
                    to: user.email,
                    subject: 'Withdrawal Successful',
                    html: userWalletEmailTemplate({
                        userName: user.displayName,
                        amount: withdrawalAmount,
                        accountNumber: accountNumber.slice(-4),
                        bankName: bankName,
                        fee: withdrawalFee,
                        newBalance: promoterWallet.balance
                    })
                });
            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
                // Don't fail the withdrawal if email fails
            }
            
            return res.status(200).json({
                message: "Withdrawal successful! Payment has been processed.",
                success: true,
                data: {
                    balance: promoterWallet.balance,
                    transaction: {
                        id: transactionToUpdate._id,
                        amount: transactionToUpdate.amount,
                        fee: transactionToUpdate.fee,
                        status: transactionToUpdate.status,
                        reference: transactionToUpdate.reference
                    },
                    security: {
                        accountVerified: true,
                        verificationLevel: verificationLevel,
                        requiresAdditionalVerification: requiresAdditionalVerification
                    }
                },
            });

        } else {
            // Payment failed: refund the total deduction
            transactionToUpdate.status = "failed";
            transactionToUpdate.failureReason = paymentResponse.message || "Payment processing failed";
            transactionToUpdate.processedAt = new Date();
            promoterWallet.balance += totalDeduction;

            await user.save({ session });
            await session.commitTransaction();
            
            return res.status(500).json({
                message: `Payment failed: ${paymentResponse.message || "Unknown error"}. Your balance has been refunded.`,
                success: false,
                code: "PAYMENT_FAILED",
                data: {
                    refundedAmount: totalDeduction,
                    newBalance: promoterWallet.balance
                }
            });
        }
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Error during withdrawal request:", error);
        res.status(500).json({
            message: "An unexpected error occurred during withdrawal processing.",
            success: false,
            code: "INTERNAL_SERVER_ERROR"
        });
    } finally {
        session.endSession();
    }
};

// Additional endpoint for account verification
export const verifyBankAccount = async (req, res) => {
    const { userId, accountNumber, accountName, bankCode, bankName } = req.body;
    
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await UserModel.findById(userId).session(session);
        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({
                message: "User not found",
                success: false,
                code: "USER_NOT_FOUND"
            });
        }

        // Enhanced verification logic
        const isVerified = validateAccountOwnership(user, accountNumber, accountName);
        const verificationLevel = getVerificationLevel(user, accountNumber, accountName);
        
        if (isVerified) {
            // Mark account as verified in saved accounts
            const existingAccountIndex = user.savedAccounts.findIndex(
                acc => acc.accountNumber === accountNumber
            );
            
            if (existingAccountIndex !== -1) {
                user.savedAccounts[existingAccountIndex].verified = true;
                user.savedAccounts[existingAccountIndex].verifiedAt = new Date();
                user.savedAccounts[existingAccountIndex].lastUsed = new Date();
            } else {
                // Add as new verified account
                user.savedAccounts.push({
                    bank: bankName,
                    bankCode: bankCode,
                    accountNumber: accountNumber,
                    accountName: accountName,
                    verified: true,
                    verifiedAt: new Date(),
                    firstUsed: new Date(),
                    lastUsed: new Date()
                });
            }

            await user.save({ session });
            await session.commitTransaction();
            
            return res.status(200).json({
                message: "Account verification successful",
                success: true,
                verified: true,
                verificationLevel: verificationLevel,
                data: {
                    accountNumber: accountNumber.slice(-4), // Return only last 4 digits for security
                    bankName: bankName,
                    verifiedAt: new Date()
                }
            });
        } else {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Account verification failed. Please ensure the account name matches your registered name exactly.",
                success: false,
                verified: false,
                verificationLevel: verificationLevel,
                details: {
                    userDisplayName: user.displayName,
                    providedAccountName: accountName,
                    suggestion: "Ensure the account name matches your profile name. Contact support if you need assistance."
                }
            });
        }
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Error during account verification:", error);
        res.status(500).json({
            message: "Account verification failed due to technical error.",
            success: false,
            code: "VERIFICATION_ERROR"
        });
    } finally {
        session.endSession();
    }
};

// Get user's verified accounts
export const getVerifiedAccounts = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: "User not found",
                success: false,
                code: "USER_NOT_FOUND"
            });
        }

        const verifiedAccounts = user.savedAccounts
            .filter(account => account.verified)
            .map(account => ({
                bank: account.bank,
                bankCode: account.bankCode,
                accountNumber: account.accountNumber.slice(-4), // Only show last 4 digits
                accountName: account.accountName,
                isDefault: account.isDefault,
                verifiedAt: account.verifiedAt,
                lastUsed: account.lastUsed
            }));

        return res.status(200).json({
            message: "Verified accounts retrieved successfully",
            success: true,
            data: {
                accounts: verifiedAccounts,
                total: verifiedAccounts.length
            }
        });
    } catch (error) {
        console.error("Error retrieving verified accounts:", error);
        res.status(500).json({
            message: "Failed to retrieve verified accounts",
            success: false,
            code: "RETRIEVAL_ERROR"
        });
    }
};