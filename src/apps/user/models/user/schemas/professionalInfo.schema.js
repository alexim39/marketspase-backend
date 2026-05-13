import mongoose from "mongoose";

const experienceSchema = new mongoose.Schema({
  company: String,
  startDate: Date,
  endDate: Date,
  description: String,
  current: Boolean
}, { _id: false });

const educationSchema = new mongoose.Schema({
  institution: String,
  certificate: String,
  fieldOfStudy: String,
  startDate: Date,
  endDate: Date,
  description: String
}, { _id: false });

const businessProfileSchema = new mongoose.Schema({
  brandName: {
    type: String,
    trim: true,
    maxlength: 120,
  },
  brandSummary: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  uniqueSellingPoints: [{
    type: String,
    trim: true,
    maxlength: 160,
  }],
}, { _id: false });

const socialProfilesSchema = new mongoose.Schema({
  website: {
    type: String,
    trim: true,
    maxlength: 300,
  },
  instagram: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  tiktok: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  facebook: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  x: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  youtube: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  linkedin: {
    type: String,
    trim: true,
    maxlength: 160,
  },
}, { _id: false });

const professionalInfoSchema = new mongoose.Schema({
  skills: [{ type: String }],
  jobTitle: { type: String, trim: true },
  profileHeadline: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  businessProfile: {
    type: businessProfileSchema,
    default: () => ({})
  },
  socialProfiles: {
    type: socialProfilesSchema,
    default: () => ({})
  },
  experience: { type: experienceSchema, default: () => ({}) },
  education: { type: educationSchema, default: () => ({}) }
}, { _id: false });

export default professionalInfoSchema;
