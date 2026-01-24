import { UserModel } from '../../models/user.model.js';

// controllers/user.controller.js
export const markMarketingRep = async (req, res) => {
  const { userId, newValue } = req.body;

  try {
    // 1. Prepare the update object
    let updateData = { isMarketingRep: newValue };

    // If newValue is false, also update the role
    if (!newValue) {
      updateData.role = 'promoter';
    }

    // 2. Perform the update (using 'let' or 'const' outside the scope)
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      updateData, // Combined object for all updates
      { new: true, runValidators: true }
    );

    // 3. Check if user exists
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 4. Return the success response
    console.log(`User ${userId} updated: isMarketingRep = ${newValue}`);
    res.status(200).json({
      success: true,
      message: `User has been ${newValue ? 'promoted to' : 'removed from'} Marketing Rep status.`,
      user: updatedUser
    });
    
  } catch (error) {
    console.error('Error updating marketing rep status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
};
