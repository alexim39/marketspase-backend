import { StoreModel } from '../../models/store/index.js';

export const getUserStores = async (req, res) => {
     try {
        //console.log('Get user stores request query:', req.query);
        const userId = req.query.userId;
        
        const stores = await StoreModel.find({ owner: userId })
        .select('-__v')
        .sort({ createdAt: -1 });

        return res.status(200).json({
        success: true,
        data: stores,
        count: stores.length
        });

    } catch (error) {
        console.error('Get stores error:', error);
        return res.status(500).json({
        success: false,
        message: 'Failed to fetch stores'
        });
    }
}