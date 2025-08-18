import mongoose from 'mongoose';

const userSchema = mongoose.Schema(
    {
        uid: {
            type: String,
            unique: true,
            required: [true, "Please enter firebaseUid"],
        },
        username: {
            type: String,
            unique: true,
            required: [true, "Please enter username"],
        },
        displayName: {
            type: String,
            trim: true,
            required: [true, "Please enter name"]
        },
        email: {
            type: String,
            //unique: true,
            trim: true,
            //required: [false, "Please enter email"],
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
        },
        password: {
            type: String,
            trim: true,
            required: [true, "Please enter password"]
        },
        authenticationMethod: {
            type: String,
            enum: ['local', 'google.com', 'facebook.com', 'twitter.com'],
            default: 'google.com'
        },
        personalInfo: {
            address: {
                street: { type: String, trim: true },
                city: { type: String, trim: true },
                state: { type: String, trim: true },
                country: { type: String, trim: true }
            },
            phone: { type: String, trim: true },
            dob: { type: Date, trim: true },
            bio: { type: String, trim: true },
            jobTitle: { type: String, trim: true },
            educationBackground: { type: String }
        },
        professionalInfo: {
            skills: [{ type: String }],
            experience: [{
                jobTitle: String,
                company: String,
                startDate: Date,
                endDate: Date,
                description: String,
                current: Boolean
            }],
            education: [{
                institution: String,
                degree: String,
                fieldOfStudy: String,
                startDate: Date,
                endDate: Date,
                description: String
            }]
        },
        interests: {
            hobbies: [{ type: String }],
            favoriteTopics: [{ type: String }]
        },
        role: {
            type: String,
            enum: ['user', 'advertiser', 'promoter', 'admin'],
            default: 'promoter'
        },
        isActive: { type: Boolean, default: true },
        verified: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        avatar: { type: String, default: 'img/avatar.png' },
        rating: {
            type: Number,
            default: 0
        },
        testimonials: [{ 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Testimonial' 
        }],
        testimonialReactions: [{
            testimonial: { type: mongoose.Schema.Types.ObjectId, ref: 'Testimonial' },
            reaction: { type: String, enum: ['like', 'dislike'] },
            createdAt: { type: Date, default: Date.now }
        }],
       
        savedAccounts: [
            {
                bank: {
                type: String,
                required: true,
                },
                bankCode: {
                type: String,
                required: true,
                },
                accountNumber: {
                type: String,
                required: true,
                },
                accountName: {
                type: String,
                required: true,
                },
            }
        ],
        balance: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

export const UserModel = mongoose.model('User', userSchema);