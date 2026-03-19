import mongoose from "mongoose";
import { ACTIVITY_RETENTION } from "../user.constants.js";

const activitySettingsSchema = new mongoose.Schema({
  retainPeriod: { 
    type: Number, 
    default: ACTIVITY_RETENTION.DEFAULT_DAYS,
    min: ACTIVITY_RETENTION.MIN_DAYS,
    max: ACTIVITY_RETENTION.MAX_DAYS
  },
  enabled: { 
    type: Boolean, 
    default: true 
  }
}, { _id: false });

export default activitySettingsSchema;