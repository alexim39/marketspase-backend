import mongoose from "mongoose";

const phoneDetailsSchema = new mongoose.Schema({
  countryCode: String,
  nationalNumber: String,
  fullNumber: String,
  iso2: String, // Country ISO code (e.g., "US", "NG")
  lastUpdated: Date
}, { _id: false });

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  country: { type: String, trim: true }
}, { _id: false });

const personalInfoSchema = new mongoose.Schema({
  address: { type: addressSchema, default: () => ({}) },
  phone: {
    type: String,
    trim: true,
    sparse: true,
    unique: true,
    index: true,
  },
  phoneDetails: { type: phoneDetailsSchema, default: () => ({}) },
  dob: { type: Date },
  biography: { type: String, trim: true },
  gender: { type: String, default: '' }
}, { _id: false });

export default personalInfoSchema;