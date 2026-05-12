import { StoreModel } from "../../models/store/index.js";
import mongoose from "mongoose";

export const setDefaultStore = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { storeId } = req.params;
    const userId = req.userId;

    // 1. Validate the store exists and belongs to the user
    const store = await StoreModel.findOne({
      _id: storeId,
      owner: userId
    }).session(session);

    if (!store) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Store not found or you don't have permission"
      });
    }

    // 2. Check if store is already default (optimization)
    if (store.isDefaultStore) {
      await session.abortTransaction();
      return res.status(200).json({
        success: true,
        message: "Store is already the default",
        data: store
      });
    }

    // 3. Update all stores for this user to NOT be default
    await StoreModel.updateMany(
      { 
        owner: userId, 
        _id: { $ne: storeId },
        isDefaultStore: true
      },
      { $set: { isDefaultStore: false } },
      { session }
    );

    // 4. Set the selected store as default
    const updatedStore = await StoreModel.findByIdAndUpdate(
      storeId,
      { $set: { isDefaultStore: true } },
      { 
        new: true,
        runValidators: true,
        session
      }
    ).populate("owner", "name email");

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `${updatedStore.name} is now your default store`,
      data: updatedStore
    });

  } catch (error) {
    await session.abortTransaction();
    
    // Handle unique constraint violation
    if (error.code === 11000 || error.message.includes("duplicate key")) {
      return res.status(409).json({
        success: false,
        message: "Default store already exists. Please contact support."
      });
    }

    console.error("Error setting default store:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set default store",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};
