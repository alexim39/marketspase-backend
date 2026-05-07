import mongoose from 'mongoose';
import { AiSettings, WhatsAppConfig } from '../../model/index.js';
import { StoreModel } from '../../../store/models/store/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import { decrypt } from '../../../../shared/utils/crypto.util.js';
import logger from '../../../../shared/utils/logger.js';

const PLAN_PRICES = {
  basic: 3000,
  advanced: 8000,
};

export class AiAssistantSettingsService {
  async getWhatsAppConnections(userId) {
    const settings = await AiSettings.findOne({ userId });
    if (!settings) return [];

    const numbers = settings.whatsappNumbers || [];
    const configs = await WhatsAppConfig.find({ userId }).lean();
    const configMap = new Map(configs.map(c => [c.phoneNumber, c.isActive]));

    return numbers.map(n => ({
      id: n.phoneNumber,
      phoneNumber: n.phoneNumber,
      aiEnabled: n.aiEnabled,
      isConnected: configMap.has(n.phoneNumber) && configMap.get(n.phoneNumber) !== false,
    }));
  }

  async addWhatsAppConnection(userId, phoneNumber) {
    logger.info(`Adding WhatsApp connection for userId: ${userId}, phoneNumber: ${phoneNumber}`);
    
    if (!/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

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

    const connections = await this.getWhatsAppConnections(userId);
    return connections.find(c => c.phoneNumber === phoneNumber);
  }

  async removeWhatsAppConnection(userId, phoneNumber) {
    console.log('Removing WhatsApp connection for userId:', userId, 'phoneNumber:', phoneNumber);
    const settings = await AiSettings.findOne({ userId });
    if (!settings) throw new Error('Settings not found');

    settings.whatsappNumbers = settings.whatsappNumbers.filter(n => n.phoneNumber !== phoneNumber);
    await settings.save();
    
    await WhatsAppConfig.findOneAndUpdate(
      { userId, phoneNumber },
      { isActive: false }
    );
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
      isConnected: true,
    };
  }

  async reconnectConnection(userId, phoneNumber) {
    const config = await WhatsAppConfig.findOne({ userId, phoneNumber, isActive: true });
    
    if (!config) {
      return { id: phoneNumber, phoneNumber, aiEnabled: false, isConnected: false };
    }

    try {
      const twilio = await import('twilio');
      const client = twilio.default(decrypt(config.twilioAccountSid), decrypt(config.twilioAuthToken));
      await client.api.accounts(decrypt(config.twilioAccountSid)).fetch();
      
      return { id: phoneNumber, phoneNumber, aiEnabled: true, isConnected: true };
    } catch (err) {
      logger.error(`Twilio reconnect failed for ${phoneNumber}:`, err.message);
      return { id: phoneNumber, phoneNumber, aiEnabled: false, isConnected: false };
    }
  }

  async getBusinessInfo(userId) {
    const settings = await AiSettings.findOne({ userId });
    const businessId = settings?.business?.toString() || null;

    let businessName = '';
    if (businessId) {
      const store = await StoreModel.findById(businessId).select('name').lean();
      businessName = store?.name || '';
    }

    const stores = await StoreModel.find({ owner: userId, isDeleted: false })
      .select('_id name')
      .lean();

    return {
      businessId,
      businessName,
      availableStores: stores.map(s => ({ id: s._id.toString(), name: s.name })),
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

    return { businessId: businessId.toString(), businessName: store.name };
  }

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

  async getCurrentPlan(userId) {
    const settings = await AiSettings.findOne({ userId });
    return settings?.subscription?.planId || 'basic';
  }

  async getAvailablePlans() {
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
          'Up to 100 AI replies/month',
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
          'Unlimited AI replies',
          'Priority support',
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

    const planPriceNaira = PLAN_PRICES[planId];

    if (marketerWallet.balance < planPriceNaira) {
      throw new Error('Insufficient balance. Please fund your wallet.');
    }

    marketerWallet.balance -= planPriceNaira;
    
    const newTx = {
      _id: new mongoose.Types.ObjectId(),
      amount: planPriceNaira * 100,
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

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);

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
    logger.info(`User ${userId} upgraded to ${planId} plan`);
  }
}