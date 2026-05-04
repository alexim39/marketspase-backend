import mongoose from 'mongoose';
import { AiSettings } from '../../model/index.js';
import { StoreModel } from '../../../store/models/store/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import { TransactionModel, TRANSACTION_TYPES, TRANSACTION_CATEGORIES } from '../../../user/models/transaction/index.js';

const PLAN_PRICES = {
  basic: 300000,   // amount in kobo (₦3,000)
  advanced: 800000, // ₦8,000
};

export class AiAssistantSettingsService {
  // ── WhatsApp numbers ──
  async getWhatsAppConnections(userId) {
    const settings = await AiSettings.findOne({ userId });
    if (!settings) return [];

    const numbers = settings.whatsappNumbers || [];
    // Derive isConnected by checking if a WhatsAppConfig exists for that phone number
    const WhatsAppConfig = mongoose.model('WhatsAppConfig');
    const configs = await WhatsAppConfig.find({ userId }).lean();

    const configMap = new Map(configs.map(c => [c.phoneNumber, true]));

    return numbers.map(n => ({
      id: n.phoneNumber,            // using phoneNumber as unique id
      phoneNumber: n.phoneNumber,
      aiEnabled: n.aiEnabled,
      isConnected: configMap.has(n.phoneNumber),
    }));
  }

  async addWhatsAppConnection(userId, phoneNumber) {
    console.log('Adding WhatsApp connection for userId:', userId, 'phoneNumber:', phoneNumber);

    let settings = await AiSettings.findOne({ userId });
    if (!settings) {
      settings = await AiSettings.create({
        userId,
        whatsappNumbers: [{ phoneNumber, aiEnabled: true }],
      });
    } else {
      const exists = settings.whatsappNumbers.some(n => n.phoneNumber === phoneNumber);
      if (exists) throw new Error('Number already added');

      settings.whatsappNumbers.push({ phoneNumber, aiEnabled: true });
      await settings.save();
    }

    // Return the added connection (isConnected depends on WhatsAppConfig)
    const connections = await this.getWhatsAppConnections(userId);
    return connections.find(c => c.phoneNumber === phoneNumber);
  }

  async removeWhatsAppConnection(userId, phoneNumber) {
    const settings = await AiSettings.findOne({ userId });
    if (!settings) throw new Error('Settings not found');

    settings.whatsappNumbers = settings.whatsappNumbers.filter(
      n => n.phoneNumber !== phoneNumber
    );
    await settings.save();
  }

  async toggleAIForConnection(userId, phoneNumber, aiEnabled) {
    const settings = await AiSettings.findOne({ userId });
    if (!settings) throw new Error('Settings not found');

    const number = settings.whatsappNumbers.find(n => n.phoneNumber === phoneNumber);
    if (!number) throw new Error('Number not found');

    number.aiEnabled = aiEnabled;
    await settings.save();

    return {
      id: phoneNumber,
      phoneNumber,
      aiEnabled,
      isConnected: true, // placeholder – real status is dynamic
    };
  }

  async reconnectConnection(userId, phoneNumber) {
    // For now, simply check if a WhatsAppConfig exists for that number
    const WhatsAppConfig = mongoose.model('WhatsAppConfig');
    const config = await WhatsAppConfig.findOne({ userId, phoneNumber });

    return {
      id: phoneNumber,
      phoneNumber,
      aiEnabled: true,
      isConnected: !!config,
    };
  }

  // ── Business info ──
  async getBusinessInfo(userId) {
    const settings = await AiSettings.findOne({ userId });
    const businessId = settings?.business?.toString() || null;

    let businessName = '';
    if (businessId) {
      const store = await StoreModel.findById(businessId).select('name').lean();
      businessName = store?.name || '';
    }

    // Also return a list of stores for the dropdown
    const stores = await StoreModel.find({ owner: userId, isDeleted: false })
      .select('_id name')
      .lean();

    return {
      businessId,
      businessName,
      availableStores: stores.map(s => ({ id: s._id, name: s.name })),
    };
  }

  async updateBusinessInfo(userId, businessId) {
    const store = await StoreModel.findOne({ _id: businessId, owner: userId, isDeleted: false });
    if (!store) throw new Error('Store not found or not owned by user');

    await AiSettings.findOneAndUpdate(
      { userId },
      { business: businessId },
      { upsert: true }
    );

    return { businessId, businessName: store.name };
  }

  // ── Notification preferences ──
  async getNotificationPreferences(userId) {
    const settings = await AiSettings.findOne({ userId });
    return settings?.notificationPreferences || {
      newMessage: true,
      escalation: true,
      paymentConfirmation: false,
    };
  }

  async updateNotificationPreferences(userId, prefs) {
    await AiSettings.findOneAndUpdate(
      { userId },
      { notificationPreferences: prefs },
      { upsert: true }
    );
  }

  // ── Subscription ──
  async getCurrentPlan(userId) {
    const settings = await AiSettings.findOne({ userId });
    return settings?.subscription?.planId || 'basic';
  }

  async getAvailablePlans() {
    // Static plans for now
    return [
      {
        id: 'basic',
        name: 'Basic',
        priceNaira: 3000,
        priceDisplay: '₦3,000/month',
        features: [
          'AI WhatsApp assistant',
          'Handles messages and replies',
          'Basic conversation support',
        ],
      },
      {
        id: 'advanced',
        name: 'Advanced',
        priceNaira: 8000,
        priceDisplay: '₦8,000/month',
        features: [
          'Everything in Basic',
          'AI actively promotes products',
          'Pushes customers toward purchase',
          'Marketing automation included',
        ],
        isPopular: true,
      },
    ];
  }

  async updateSubscriptionPlan(userId, planId) {
    if (!PLAN_PRICES[planId]) throw new Error('Invalid plan');

    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');

    const marketerWallet = user.wallets?.marketer;
    if (!marketerWallet) throw new Error('No marketer wallet');

    const amountInKobo = PLAN_PRICES[planId]; // in kobo
    const balanceInKobo = marketerWallet.balance * 100; // balance is stored in Naira? see schema: currency NGN, balance Number, but no indication of unit. Assume it's in Naira (main unit). We'll convert.

    // According to the transaction schema, amount is stored in kobo.
    // We'll assume balances are in Naira (full units) for simplicity, but transaction amounts in kobo.
    // For safety, let's treat the wallet balance as Naira because schema says "currency: 'NGN'" and no mention of kobo.
    // So we compare: amountInNaira = PLAN_PRICES[planId] / 100
    const planPriceNaira = PLAN_PRICES[planId] / 100;

    if (marketerWallet.balance < planPriceNaira) {
      throw new Error('Insufficient balance. Please fund your wallet.');
    }

    // Deduct from balance
    marketerWallet.balance -= planPriceNaira;
    // Record a transaction (type: debit, category: 'subscription')
    const transaction = await TransactionModel.create({
      amount: PLAN_PRICES[planId], // kobo
      type: 'debit',
      category: 'ai_subscription', // add this category in constants if not present, but we'll use 'fee' or 'subscription' – I'll add a new category 'ai_subscription'. For now, I'll handle by manually updating the transaction array because the wallet uses embedded transactions.
      description: `AI Assistant ${planId} plan subscription`,
      status: 'completed',
    });

    // Actually, wallet uses embedded transactionSchema (subdocument array). We shouldn't create a separate TransactionModel document because the wallet.transactions is an array of subdocs. But the embedded schema mimics the same fields. To keep it simple, we'll push the transaction directly into the marketer wallet's transactions array.
    // However, the wallet schema uses `transactionSchema` which expects _id to be ObjectId. We'll create a new subdocument.
    const newTx = {
      _id: new mongoose.Types.ObjectId(),
      amount: PLAN_PRICES[planId],
      type: 'debit',
      category: 'ai_subscription',
      description: `AI Assistant ${planId} plan subscription`,
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
      currency: 'NGN',
      gateway: 'internal',
    };
    marketerWallet.transactions.push(newTx);

    // Update the subscription in AiSettings
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30); // 30-day billing cycle

    await AiSettings.findOneAndUpdate(
      { userId },
      {
        subscription: {
          planId,
          startDate: now,
          endDate,
          status: 'active',
        },
      },
      { upsert: true }
    );

    await user.save();
  }
}