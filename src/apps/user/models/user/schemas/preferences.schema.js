import mongoose from "mongoose";

const themePreferencesSchema = new mongoose.Schema({
  darkMode: { type: Boolean, default: false },
  highContrast: { type: Boolean, default: false },
  systemDefault: { type: Boolean, default: true }
}, { _id: false });

const preferencesSchema = new mongoose.Schema({
  notification: { type: Boolean, default: true },
  categoryBasedAds: { type: Boolean, default: false },
  locationBasedAds: { type: Boolean, default: false },
  adCategories: [{ type: String }],
  theme: { type: themePreferencesSchema, default: () => ({}) }
}, { _id: false });

export default preferencesSchema;