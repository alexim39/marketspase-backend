import mongoose from "mongoose";
import { VARIATION_TYPE_ARRAY } from "../newsletter.constants.js";

const abTestSchema = new mongoose.Schema({
  isVariation: { type: Boolean, default: false },
  parentNewsletter: { type: mongoose.Schema.Types.ObjectId, ref: 'Newsletter' },
  variationType: { type: String, enum: VARIATION_TYPE_ARRAY },
  winner: { type: Boolean } // Mark if this variation won the test
}, { _id: false });

export default abTestSchema;