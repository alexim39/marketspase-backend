import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      unique: true,
      required: true, // Firebase or custom auth UID
    },
    username: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    displayName: { type: String, trim: true, required: true },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true, // optional but unique if provided
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String,
      trim: true,
      required: function () { return this.authenticationMethod === 'local'; },
    },
    authenticationMethod: {
      type: String,
      enum: ['local', 'google.com', 'facebook.com', 'twitter.com'],
      default: 'google.com',
    },

    role: {
      type: String,
      enum: ['advertiser', 'promoter', 'admin'],
      default: 'promoter',
    },

    avatar: { type: String, default: '/img/avatar.png' },
    phone: { type: String, trim: true },

    // Financials
    balance: { type: Number, default: 0 },
    transactions: [{
      amount: Number,
      type: { type: String, enum: ['credit', 'debit'] },
      description: String,
      relatedCampaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
      createdAt: { type: Date, default: Date.now }
    }],
    payoutAccounts: [{
      bank: String,
      bankCode: String,
      accountNumber: String,
      accountName: String,
      isDefault: { type: Boolean, default: false }
    }],

    // Engagement & trust
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    testimonials: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Testimonial' }],

    // System flags
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },

    /*
    Needed for advanced campaign targeting
    */
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
    }
  },
  { timestamps: true }
);

export const UserModel = mongoose.model('User', userSchema);
