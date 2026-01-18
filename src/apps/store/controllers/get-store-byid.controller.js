import { StoreModel } from '../models/store.model.js';


export const getStoreById = async (req, res) => {
    try {
      const { storeId } = req.params;
      const userId = req.user?._id;

      const store = await StoreModel.findOne({
        _id: storeId,
        owner: userId
      }).select('-__v');

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: store
      });

    } catch (error) {
      console.error('Get store error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch store'
      });
    }
}