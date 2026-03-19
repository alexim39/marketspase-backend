import mongoose from "mongoose";
import testimonialSchema from "./testimonial.schema.js";
import { setupTestimonialVirtuals } from "./testimonial.virtuals.js";
import { setupTestimonialMethods } from "./testimonial.methods.js";
import { setupTestimonialStatics } from "./testimonial.statics.js";
import { setupTestimonialMiddleware } from "./testimonial.middleware.js";
import { setupTestimonialIndexes } from "./testimonial.indexes.js";

// Setup all schema extensions
setupTestimonialVirtuals(testimonialSchema);
setupTestimonialMethods(testimonialSchema);
setupTestimonialStatics(testimonialSchema);
setupTestimonialMiddleware(testimonialSchema);
setupTestimonialIndexes(testimonialSchema);

export const TestimonialModel = mongoose.model("Testimonial", testimonialSchema);