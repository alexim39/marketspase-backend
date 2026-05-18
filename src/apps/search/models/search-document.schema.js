import mongoose from 'mongoose';

const searchDocumentSchema = new mongoose.Schema({
  entityType: {
    type: String,
    enum: ['user', 'campaign', 'promotion', 'product', 'store'],
    required: true,
    index: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  subtitle: {
    type: String,
    trim: true,
    default: '',
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  normalizedTitle: {
    type: String,
    trim: true,
    default: '',
  },
  normalizedSubtitle: {
    type: String,
    trim: true,
    default: '',
  },
  normalizedDescription: {
    type: String,
    trim: true,
    default: '',
  },
  keywords: {
    type: [String],
    default: [],
  },
  searchTerms: {
    type: [String],
    default: [],
  },
  searchPrefixes: {
    type: [String],
    default: [],
  },
  region: {
    country: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    label: { type: String, trim: true, default: '' },
  },
  status: {
    type: String,
    trim: true,
    default: '',
    index: true,
  },
  userType: {
    type: String,
    trim: true,
    default: '',
    index: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  relatedOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    default: null,
  },
  relatedCampaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    default: null,
  },
  primaryImage: {
    type: String,
    trim: true,
    default: '',
  },
  visibility: {
    type: String,
    enum: ['public', 'restricted'],
    default: 'public',
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  minimize: false,
});

export default searchDocumentSchema;
