import { UserModel } from '../../../user/models/user.model.js';

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