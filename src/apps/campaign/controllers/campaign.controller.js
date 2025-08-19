import { TransactionModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { sendEmail } from "../../../services/emailService.js";
import { ownerEmailTemplate } from "../services/email/ownerTemplate.js";
import { userWithdrawalEmailTemplate } from "../services/email/userTemplate.js";
import { processPayment } from "../services/process-payment.js"


export const getTransactions = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find transactions where userId matches the provided ID and sort by creation date in descending order
        const transac = await TransactionModel.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            message: "Transaction retrieved successfully!",
            data: transac,
            success: true,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Error retrieving transactions",
            success: false,
        });
    }
};

// User withdrawal request
export const withdrawRequest = async (req, res) => {
    const { bank, accountNumber, accountName, amount, userId, saveAccount, bankName } = req.body;

    //console.log("withdrawRequest", req.body);return;

    try {
        // Find the user by ID
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(400).json({
                message: "User not found",
                success: false,
            });
        }

        // Check if the user has sufficient balance
        if (user.balance < amount) {
            return res.status(400).json({
                message: "Insufficient balance for transaction",
                success: false,
            });
        }

        // Deduct the amount from user's balance
        user.balance -= amount;
        await user.save();

        // Generate a unique reference ID
        const reference = Math.floor(100000000 + Math.random() * 900000000).toString();

        // Record the transaction as pending
        const transaction = new TransactionModel({
            userId: user._id,
            amount: amount,
            status: "Pending",
            paymentMethod: "Withdrawal",
            transactionType: "Debit", // its credit when the user bank account is credited
            bankDetail: {
                bankCode: bank,
                accountNumber: accountNumber,
                accountName: accountName,
            },
            reference,
        });
        await transaction.save();

        // Process the automatic payment
        const paymentResponse = await processPayment(bank, accountNumber, accountName, amount);

        if (paymentResponse.success) {
            // Update transaction status to successful
            transaction.status = "Successful";
            await transaction.save();

            // // Send email notification to owner
            const ownerSubject = "New Withdrawal Request";
            const ownerMessage = ownerEmailTemplate(user);
            const ownerEmails = ["ago.fnc@gmail.com"];
            for (const email of ownerEmails) {
                await sendEmail(email, ownerSubject, ownerMessage);
            }

            // Send email notification to the user
            const userSubject = "Successful Withdrawal - MarketSpase";
            const userMessage = userWithdrawalEmailTemplate(user, req.body);
            await sendEmail(user.email, userSubject, userMessage);


            // If the user chooses to save the account, add it to their saved accounts
            if (saveAccount) {
                const existingAccount = user.savedAccounts.find(
                    (account) => account.accountNumber === accountNumber
                );

                if (!existingAccount) {
                    user.savedAccounts.push({
                        bankCode: bank,
                        accountNumber: accountNumber,
                        accountName: accountName,
                        bank: bankName,
                    });
                    await user.save();
                }
            }

            return res.status(200).json({
                message: "Withdrawal successful, payment has been processed.",
                data: transaction,
                success: true,
            });
        } else {
            // If payment fails, refund balance and update transaction status
            user.balance += amount;
            await user.save();

            transaction.status = "Failed";
            await transaction.save();

            // Notify the user and owner of the failure
            const failureSubject = "Withdrawal Failed";
            const failureMessage = userWithdrawalEmailTemplate(user, req.body, "Failed");
            await sendEmail(user.email, failureSubject, failureMessage);

            return res.status(500).json({
                message: "Payment failed. Your balance has been refunded.",
                data: transaction,
                success: false,
            });
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "An error occurred while processing the withdrawal.",
            success: false,
        });
    }
};


// Delete saved accounts
export const deleteSavedAccount = async (req, res) => {
    try {
        const { userId, accountId } = req.params;

        // Find the user by ID
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Find the account to delete
        const accountIndex = user.savedAccounts.findIndex(
            (account) => account._id.toString() === accountId
        );

        if (accountIndex === -1) {
            return res.status(404).json({ success: false, message: 'Saved account not found' });
        }

        // Remove the account from the savedAccounts array
        user.savedAccounts.splice(accountIndex, 1);

        // Save the updated user document
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Saved account deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting saved account:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the saved account',
        });
    }
};