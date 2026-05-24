import mongoose from 'mongoose';
import notificationPreferenceSchema from './notification-preference.schema.js';

export const NotificationPreferenceModel = mongoose.model(
  'NotificationPreference',
  notificationPreferenceSchema
);

