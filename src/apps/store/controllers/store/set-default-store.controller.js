import { StoreModel } from "../../models/store/index.js";
import mongoose from "mongoose";
import { ensureStoreWriteAccess } from "../../services/store-authorization.service.js";

export const setDefaultStore = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { storeId } = req.params;
    const userId = req.userId;
    const uid = typeof req.user?.uid === "string" ? req.user.uid : null;

    // 1. Validate the store exists and belongs to the user (supports legacy ownership formats).
    const { store } = await ensureStoreWriteAccess({ storeId, req, session });

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

    // Legacy support: if any stores still have owner stored as UID string, migrate + unset defaults for them too.
    if (uid) {
      const legacyRows = await StoreModel.collection
        .find({ owner: uid }, { projection: { _id: 1 } })
        .toArray();
      const legacyIds = legacyRows.map((row) => row?._id).filter(Boolean);

      if (legacyIds.length) {
        await StoreModel.updateMany(
          { _id: { $in: legacyIds, $ne: store._id } },
          { $set: { owner: new mongoose.Types.ObjectId(userId), isDefaultStore: false } },
          { session }
        );
      }
    }

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

    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: error.status === 404 ? 'Store not found' : 'Store not found or you don\'t have permission',
      });
    }
    
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
