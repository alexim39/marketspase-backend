import mongoose from "mongoose";

export const AD_PREFERENCE_CATEGORIES = [
  'fashion',
  'food',
  'tech',
  'health',
  'travel',
  'education',
  'entertainment',
  'business',
  'lifestyle',
  'automotive',
  'sports',
  'realestate',
  'events',
  'gaming',
  'nonprofit',
  'politics',
  'religion',
  'parenting',
  'pets',
  'art',
  'home',
  'science',
  'jobs',
  'finance',
  'insurance',
  'legal',
  'music',
  'movies',
  'telecom',
  'utilities',
  'crypto',
  'environment',
  'agriculture',
  'shopping',
  'alcohol',
  'beauty',
  'fashionmen',
  'fashionwomen',
  'kids',
  'books',
  'luxury',
  'arts',
  'software',
  'hardware',
  'productivity',
  'dating',
  'transport',
  'startups',
  'influencers',
  'reviews',
  'other',
];

const themePreferencesSchema = new mongoose.Schema({
  darkMode: { type: Boolean, default: false },
  highContrast: { type: Boolean, default: false },
  systemDefault: { type: Boolean, default: true }
}, { _id: false });

const financialPreferencesSchema = new mongoose.Schema({
  displayCurrency: { type: String, default: 'NGN', uppercase: true, trim: true },
}, { _id: false });

const preferencesSchema = new mongoose.Schema({
  notification: { type: Boolean, default: true },
  categoryBasedAds: { type: Boolean, default: false },
  locationBasedAds: { type: Boolean, default: true },
  adCategories: {
    type: [{
      type: String,
      trim: true,
      lowercase: true,
      enum: AD_PREFERENCE_CATEGORIES,
    }],
    default: [],
    validate: {
      validator: (values = []) => Array.isArray(values) && values.length <= 6,
      message: 'A maximum of 6 ad categories can be selected',
    },
  },
  theme: { type: themePreferencesSchema, default: () => ({}) },
  financial: { type: financialPreferencesSchema, default: () => ({}) },
}, { _id: false });

export default preferencesSchema;
