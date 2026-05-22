import mongoose from 'mongoose';
import { StoreModel } from '../models/store/index.js';
import { UserModel } from '../../user/models/user/index.js';

const toStringSafe = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return value.toString();
  } catch {
    return '';
  }
};

export const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value._id) return toIdString(value._id);
  return toStringSafe(value);
};

const getActor = (req) => {
  return {
    userId: toIdString(req.userId || req.user?._id),
    uid: toStringSafe(req.user?.uid),
    role: toStringSafe(req.user?.role),
  };
};

export const isAdminActor = (req) => {
  const role = toStringSafe(req.user?.role);
  return role === 'admin' || role === 'super-admin';
};

export const ensureStoreWriteAccess = async (args) => {
  const { storeId, req, session = null, allowAdmin = false } = args || {};

  if (!storeId) {
    const error = new Error('Store ID is required');
    error.status = 400;
    throw error;
  }

  const storeQuery = StoreModel.findById(storeId);
  if (session) storeQuery.session(session);
  const store = await storeQuery;

  if (!store) {
    const error = new Error('Store not found');
    error.status = 404;
    throw error;
  }

  const { userId, uid } = getActor(req);

  if (allowAdmin && isAdminActor(req)) {
    return { store, migratedOwner: false };
  }

  if (!userId) {
    const error = new Error('Authentication required');
    error.status = 401;
    throw error;
  }

  const ownerValue = store.owner;
  const ownerStr = toIdString(ownerValue);

  // Normal: store is owned by the current authenticated Mongo user id.
  if (ownerStr && ownerStr === userId) {
    return { store, migratedOwner: false };
  }

  // Legacy: some stores were created when the system used UID (Firebase) as the owner reference.
  // If we can prove identity via UID, allow the update and migrate the store to the canonical Mongo user id.
  if (uid) {
    // Case A: owner is directly the UID string.
    if (ownerStr && ownerStr === uid) {
      await StoreModel.updateOne(
        { _id: store._id },
        { $set: { owner: new mongoose.Types.ObjectId(userId) } },
        session ? { session } : undefined
      );
      store.owner = new mongoose.Types.ObjectId(userId);
      return { store, migratedOwner: true };
    }

    // Case B: owner points at a different user record that still represents the same Firebase identity.
    if (mongoose.Types.ObjectId.isValid(ownerStr)) {
      const ownerUserQuery = UserModel.findById(ownerStr).select('_id uid').lean();
      if (session) ownerUserQuery.session(session);
      const ownerUser = await ownerUserQuery;

      if (ownerUser && toStringSafe(ownerUser.uid) === uid) {
        await StoreModel.updateOne(
          { _id: store._id },
          { $set: { owner: new mongoose.Types.ObjectId(userId) } },
          session ? { session } : undefined
        );
        store.owner = new mongoose.Types.ObjectId(userId);
        return { store, migratedOwner: true };
      }
    }
  }

  const error = new Error('You are not authorized to update this store');
  error.status = 403;
  throw error;
};

