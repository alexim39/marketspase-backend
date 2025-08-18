import mongoose from 'mongoose';

const testimonialSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        message: {
            type: String,
            maxlength: [500, "Testimonial cannot exceed 500 characters"],
            trim: true,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        likes: {
            type: Number,
            default: 0,
            min: 0
        },
        dislikes: {
            type: Number,
            default: 0,
            min: 0
        },
        reactions: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            reaction: {
                type: String,
                enum: ['like', 'dislike'],
                required: true
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
        isFeatured: {
            type: Boolean,
            default: false
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: 5
        }
    },
    { timestamps: true }
);

// Add indexes for better performance
testimonialSchema.index({ 'reactions.userId': 1 });
testimonialSchema.index({ 'reactions.createdAt': 1 });
testimonialSchema.index({ user: 1 });
testimonialSchema.index({ status: 1 });
testimonialSchema.index({ isFeatured: 1 });

export const TestimonialModel = mongoose.model('Testimonial', testimonialSchema);