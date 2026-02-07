import { UserModel } from '../../../user/models/user.model.js';
import { sendEmail } from "../../../../services/email.service.js";
import mongoose from 'mongoose';
import { accountVerifiedTemplate } from '../../services/email/accountVerifiedTemplate.js';
import { getVerificationLevel } from '../../services/get-verify-level.service.js';

/**
 * --- Helper: Account ownership verification ---
 */
export const validateAccountOwnership = (user, accountNumber, accountName) => {
  const savedAccount = user.savedAccounts.find(
    (account) => account.accountNumber === accountNumber
  );

  if (savedAccount) {
    if (savedAccount.verified) {
      console.log(`Using pre-verified account: ${accountNumber}`);
      return true;
    }

    const isNameMatch = validateNameWithProfile(user, accountName);
    console.log(`Saved account name match result: ${isNameMatch}`);
    return isNameMatch;
  }

  const isNameMatch = validateNameWithProfile(user, accountName);
  console.log(`New account name match result: ${isNameMatch}`);
  return isNameMatch;
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


            // Send account verification success email
            try {
                const emailContent = accountVerifiedTemplate({
                    userName: user.displayName,
                    bankName: bankName,
                    accountNumber: accountNumber.slice(-4),
                    accountName: accountName
                });
                
                await sendEmail(
                    user.email,
                    'Bank Account Verified - MarketSpase',
                    emailContent
                );
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
                // Don't fail the verification if email fails
            }

            
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
