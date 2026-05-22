import { StoreModel } from '../../models/store/index.js';
import mongoose from 'mongoose';

export const getUserStores = async (req, res) => {
     try {
        //console.log('Get user stores request query:', req.query);
        const userId = req.userId;
        const uid = typeof req.user?.uid === 'string' ? req.user.uid : null;

        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }
        
        const stores = await StoreModel.find({ owner: userId })
          .select('-__v')
          .sort({ createdAt: -1 });

        // Backward compatibility: older store records may have "owner" stored as a Firebase UID string.
        // Mongoose will cast owner queries to ObjectId and can throw on invalid values, so we use a raw query
        // to discover those records and then re-hydrate them by _id.
        if (uid) {
          const cursor = StoreModel.collection.find({ owner: uid }, { projection: { _id: 1 } });
          const legacyIds = (await cursor.toArray()).map((row) => row?._id).filter(Boolean);

          if (legacyIds.length) {
            const legacyStores = await StoreModel.find({ _id: { $in: legacyIds.map((id) => new mongoose.Types.ObjectId(id)) } })
              .select('-__v')
              .sort({ createdAt: -1 });

            // Merge (avoid duplicates if any store was already included)
            const seen = new Set(stores.map((s) => String(s._id)));
            for (const legacy of legacyStores) {
              if (!seen.has(String(legacy._id))) stores.push(legacy);
            }

            // Opportunistic migration: update legacy stores to use canonical Mongo userId.
            setImmediate(() => {
              StoreModel.updateMany(
                { _id: { $in: legacyIds } },
                { $set: { owner: new mongoose.Types.ObjectId(userId) } }
              ).catch(() => {});
            });
          }
        }

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
