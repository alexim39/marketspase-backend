import { UserModel } from './../models/user.model.js';

// @desc    Switch user
// @route   POST /api/users/switch-user
// @access  Private
export const SwitchUser = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required in the request body.'
            });
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Check if the user's current role is either 'promoter' or 'advertiser'
        if (user.role !== 'promoter' && user.role !== 'advertiser') {
            return res.status(400).json({
                success: false,
                message: `User's current role '${user.role}' cannot be switched. Only 'promoter' and 'advertiser' roles are supported for switching.`
            });
        }

        // Determine the new role based on the current role
        const newRole = user.role === 'promoter' ? 'advertiser' : 'promoter';

        // Update the user's role
        user.role = newRole;
        const updatedUser = await user.save();

        // Respond with success
        res.status(200).json({
            success: true,
            //data: updatedUser,
            message: `User role successfully switched to '${newRole}'.`
        });

    } catch (error) {
        console.error('Error switching user role:', error);
        res.status(500).json({ success: false, message: 'Server error. Failed to switch user role.' });
    }
};

