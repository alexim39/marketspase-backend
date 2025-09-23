import { UserModel} from '../../user/models/user.model.js';

// Delete saved accounts
export const deleteSavedAccount = async (req, res) => {
    try {
        const { userId, accountNumber } = req.params;

        if (!userId || !accountNumber) {
            return res.status(400).json({ success: false, message: 'User ID and Account ID are required.' });
        }

        // Find the user by ID
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Find the index of the account to delete
        const accountIndex = user.savedAccounts.findIndex(
            (account) => account.accountNumber.toString() === accountNumber
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
            data: user.savedAccounts,
        });
    } catch (error) {
        console.error('Error deleting saved account:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the saved account',
        });
    }
};