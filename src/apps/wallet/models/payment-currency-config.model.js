import mongoose from 'mongoose';

const capabilitySchema = new mongoose.Schema({
  display: { type: Boolean, default: true },
  deposit: { type: Boolean, default: false },
  checkout: { type: Boolean, default: false },
  withdrawal: { type: Boolean, default: false },
}, { _id: false });

const supportedCurrencySchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  symbol: { type: String, trim: true, default: '' },
  capabilities: { type: capabilitySchema, default: () => ({}) },
  paystackChargeSupported: { type: Boolean, default: false },
  paystackTransferSupported: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
}, { _id: false });

const paymentCurrencyConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    unique: true,
    default: 'default',
    index: true,
  },
  baseCurrency: {
    type: String,
    uppercase: true,
    trim: true,
    default: 'NGN',
  },
  ratesSource: {
    type: String,
    enum: ['manual', 'exchangerate_host'],
    default: 'exchangerate_host',
  },
  refreshIntervalMinutes: {
    type: Number,
    default: 60,
    min: 5,
    max: 1440,
  },
  quoteLockMinutes: {
    type: Number,
    default: 30,
    min: 5,
    max: 720,
  },
  supportedCurrencies: {
    type: [supportedCurrencySchema],
    default: () => ([
      {
        code: 'NGN',
        name: 'Nigerian Naira',
        symbol: '₦',
        capabilities: { display: true, deposit: true, checkout: true, withdrawal: true },
        paystackChargeSupported: true,
        paystackTransferSupported: true,
        sortOrder: 0,
      },
      {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        capabilities: { display: true, deposit: true, checkout: true, withdrawal: false },
        paystackChargeSupported: true,
        paystackTransferSupported: false,
        sortOrder: 1,
      },
      {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        capabilities: { display: true, deposit: false, checkout: false, withdrawal: false },
        paystackChargeSupported: false,
        paystackTransferSupported: false,
        sortOrder: 2,
      },
      {
        code: 'GBP',
        name: 'British Pound',
        symbol: '£',
        capabilities: { display: true, deposit: false, checkout: false, withdrawal: false },
        paystackChargeSupported: false,
        paystackTransferSupported: false,
        sortOrder: 3,
      },
    ]),
  },
  rates: {
    type: Map,
    of: Number,
    default: () => ({
      NGN: 1,
      USD: 0.00063,
      EUR: 0.00058,
      GBP: 0.0005,
    }),
  },
  lastFetchedAt: {
    type: Date,
    default: null,
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

paymentCurrencyConfigSchema.index({ updatedAt: -1 });

export const PaymentCurrencyConfigModel = mongoose.models.PaymentCurrencyConfig
  || mongoose.model('PaymentCurrencyConfig', paymentCurrencyConfigSchema);

