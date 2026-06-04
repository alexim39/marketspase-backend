import { UserModel } from '../../models/user/index.js';
import { UpdateMarketingRepStatusDto } from '../../application/dto/update-marketing-rep-status.dto.js';
import { UpdateMarketingRepStatusUseCase } from '../../application/use-cases/update-marketing-rep-status.use-case.js';
import { MongooseAdminMarketingRepGateway } from '../../infrastructure/gateways/mongoose-admin-marketing-rep.gateway.js';

const isUserAdminDddEnabled = () => process.env.USER_ADMIN_DDD_ENABLED !== 'false';
const adminMarketingRepGateway = new MongooseAdminMarketingRepGateway();
const updateMarketingRepStatusUseCase = new UpdateMarketingRepStatusUseCase({ adminMarketingRepGateway });

// controllers/user.controller.js
export const markMarketingRep = async (req, res) => {
  if (isUserAdminDddEnabled()) {
    const { userId, newValue } = req.body;

    try {
      const response = await updateMarketingRepStatusUseCase.execute(
        UpdateMarketingRepStatusDto.fromRequest({
          body: req.body || {},
        })
      );

      if (response.statusCode === 200) {
        console.log(`User ${userId} updated: isMarketingRep = ${newValue}`);
      }

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error('Error updating marketing rep status:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

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
