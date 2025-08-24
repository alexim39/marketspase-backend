import { UserModel } from "../../user/models/user.model.js";


// Toggle notification
export const toggleNotification = async (req, res) => {
  try {
    const { state, userId } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    if (typeof state !== 'boolean') {
      return res.status(400).json({ message: 'State must be a boolean' });
    }

    // Find the partner by ID
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update the notification setting
    user.preferences.notification = state;
    await user.save();

    res.status(200).json({
      message: `Notifications ${state ? 'enabled' : 'disabled'} successfully`,
      data: {
        userId: user._id,
        notificationState: user.notification,
      },
      success: true,
    });
  } catch (error) {
    console.error('Error updating notification setting:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};



