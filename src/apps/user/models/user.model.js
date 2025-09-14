import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true }, // credit = money in, debit = money out

  category: { 
    type: String, 
    enum: [
      'deposit',       // funding wallet
      'withdrawal',    // payout to bank/mobile money
      'campaign',      // marketer spend
      'promotion',     // promoter earning
      'bonus',         // referral/loyalty bonus
      'fee',           // platform/admin fees
      'refund',         // marketer refund
      'transfer',
      'commission'
    ],
    required: true
  },

  description: { type: String, trim: true },

  // Context references (only used if relevant)
  relatedCampaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  relatedPromotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },

  // Transaction state tracking
  status: { 
    type: String, 
    enum: ['pending', 'successful', 'failed', 'reserved'], 
    default: 'pending' 
  },

  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const walletSchema = new mongoose.Schema({
  balance: { type: Number, default: 0 },  // Available balance
  reserved: { type: Number, default: 0 }, // Funds locked in escrow
  transactions: [transactionSchema]
}, { _id: false });

const payoutAccountSchema = new mongoose.Schema({
  bank: String,
  bankCode: String,
  accountNumber: String,
  accountName: String,
  isDefault: { type: Boolean, default: false }
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true, trim: true },
    displayName: { type: String, trim: true, required: true },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
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
      enum: ['marketer', 'promoter', 'admin'],
      default: 'promoter',
    },

    avatar: { type: String, default: '/img/avatar.png' },
    phone: { type: String, trim: true },

    // Dual wallets (separate tracking for each role)
    wallets: {
      marketer: { type: walletSchema, default: () => ({}) },
      promoter: { type: walletSchema, default: () => ({}) },
    },

    savedAccounts: [payoutAccountSchema],

    // Engagement & trust
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    testimonials: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Testimonial' }],

    // System flags
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },

    // Targeting info
    personalInfo: {
      address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true }
      },
      phone: { type: String, trim: true },
      dob: { type: Date },
      biography: { type: String, trim: true },
    },
    professionalInfo: {
      skills: [{ type: String }],
      jobTitle: { type: String, trim: true },
      experience: {
        company: String,
        startDate: Date,
        endDate: Date,
        description: String,
        current: Boolean
      },
      education: {
        institution: String,
        certificate: String,
        fieldOfStudy: String,
        startDate: Date,
        endDate: Date,
        description: String
      }
    },
    interests: {
      hobbies: [{ type: String }],
      favoriteTopics: [{ type: String }]
    },
    preferences: {
      notification: {
        type: Boolean,
        default: true,
      },
    }
  },
  { timestamps: true }
);

export const UserModel = mongoose.model('User', userSchema);
