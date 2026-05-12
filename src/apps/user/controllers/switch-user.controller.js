import { UserModel } from './../models/user/index.js';


// @desc    Switch user
// @route   POST /api/users/switch-user
// @access  Private

// switch-user.controller.js
export const SwitchUser = async (req, res) => {
  try {
    const userId = req.userId;
    const { role } = req.body;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    if (!['promoter', 'marketer', 'marketing_rep'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid target role.' });
    }

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role !== 'promoter' && user.role !== 'marketer' && user.role !== 'marketing_rep') {
      return res.status(400).json({ success: false, message: `User's current role '${user.role}' cannot be switched.` });
    }

    //const newRole = user.role === 'promoter' ? 'marketer' : 'promoter';

    const activity = {
      action: 'role_change',
      description: `You switched user role to ${role}`,
      timestamp: new Date(),
    };
    console.log(`User role switched successfully for user: ${user.username} to role: ${role}`);

    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: { role },
        $push: { activityLog: { $each: [activity], $position: 0, $slice: 1000 } },
      }
    );

    return res.status(200).json({ success: true, message: `User role successfully switched to '${role}'.` });
  } catch (error) {
    console.error('Error switching user role:', error);
    return res.status(500).json({ success: false, message: 'Server error. Failed to switch user role.' });
  }
};


// export const SwitchUser = async (req, res) => {
//     try {
//         const { userId } = req.body;

//         if (!userId) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'userId is required in the request body.'
//             });
//         }

//         const user = await UserModel.findById(userId);

//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'User not found.'
//             });
//         }

//         // Check if the user's current role is either 'promoter' or 'marketer'
//         if (user.role !== 'promoter' && user.role !== 'marketer') {
//             return res.status(400).json({
//                 success: false,
//                 message: `User's current role '${user.role}' cannot be switched. Only 'promoter' and 'marketer' roles are supported for switching.`
//             });
//         }

//         // Determine the new role based on the current role
//         const newRole = user.role === 'promoter' ? 'marketer' : 'promoter';

//         // Update the user's role
//         user.role = newRole;
//         const updatedUser = await user.save();

//         // log this activity
//         await user.logActivity('role_change', `You switched user role to ${user.role}`, {});
//         console.log(`User role switched successfully for user: ${user.username} to role: ${newRole}`);

//         // Respond with success
//         res.status(200).json({
//             success: true,
//             //data: updatedUser,
//             message: `User role successfully switched to '${newRole}'.`
//         });

//     } catch (error) {
//         console.error('Error switching user role:', error);
//         res.status(500).json({ success: false, message: 'Server error. Failed to switch user role.' });
//     }
// };
