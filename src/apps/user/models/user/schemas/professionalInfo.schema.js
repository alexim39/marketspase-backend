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

const professionalInfoSchema = new mongoose.Schema({
  skills: [{ type: String }],
  jobTitle: { type: String, trim: true },
  experience: { type: experienceSchema, default: () => ({}) },
  education: { type: educationSchema, default: () => ({}) }
}, { _id: false });

export default professionalInfoSchema;