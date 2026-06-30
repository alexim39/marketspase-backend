import { ServiceModel } from '../../models/service/service.model.js';
import { ServiceInquiryModel } from '../../models/service/service-inquiry.model.js';
import { ServiceBookingModel } from '../../models/service/service-booking.model.js';
import { StoreModel } from '../../models/store/index.js';
import { StoreCustomerModel } from '../../models/store-customer/index.js';
import { PromotionTrackingModel } from '../../models/promotion/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import { sendEmail } from '../../../../core/email.service.js';
import { inquiryReceivedTemplate, bookingReceivedTemplate } from '../../services/email/service-notification.templates.js';

const PLATFORM_FEE_RATE = 0.20;

export const createService = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await StoreModel.findOne({ _id: storeId, owner: req.userId });
    if (!store || store.type !== 'service') return res.status(400).json({ success: false, message: 'Invalid service store' });

    const service = await ServiceModel.create({
      store: storeId, provider: req.userId, ...req.body,
    });
    // Auto-publish if not explicitly set to false
    if (req.body.isPublished !== false) {
      service.isPublished = true;
      await service.save();
    }
    return res.status(201).json({ success: true, data: service });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const getStoreServices = async (req, res) => {
  try {
    const query = { store: req.params.storeId, isDeleted: false };
    if (req.query.published === 'true') query.isPublished = true;
    const services = await ServiceModel.find(query).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: services });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const discoverServices = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    const query = { isActive: true, isPublished: true, isDeleted: false };
    if (category) query.category = new RegExp(category, 'i');
    if (search) query.$or = [{ name: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }];
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const [services, total] = await Promise.all([
      ServiceModel.find(query).skip((page - 1) * limit).limit(Number(limit))
        .populate('store', 'name logo type')
        .sort({ subscriptionTier: -1, createdAt: -1 }).lean(),
      ServiceModel.countDocuments(query),
    ]);

    const now3DaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const results = services.map(s => ({
      ...s,
      inGracePeriod: s.subscriptionTier !== 'free' && s.subscriptionExpiresAt && s.subscriptionExpiresAt < new Date() && s.subscriptionExpiresAt > now3DaysAgo,
    }));

    return res.json({ success: true, data: { services: results, total, page: Number(page), limit: Number(limit) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const submitInquiry = async (req, res) => {
  try {
    const { serviceId, customer, message, budget, timeline, trackingCode } = req.body;
    const service = await ServiceModel.findById(serviceId);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

    let promoter = null;
    let promotionTracking = null;
    let leadCommission = 0;

    if (trackingCode) {
      promotionTracking = await PromotionTrackingModel.findOne({ uniqueCode: trackingCode, isActive: true });
      if (promotionTracking) {
        promoter = promotionTracking.promoter;
        leadCommission = service.affiliate?.commissionType === 'per_lead' ? (service.affiliate.leadCommission || 1000) : 0;
      }
    }

    const inquiry = await ServiceInquiryModel.create({
      service: serviceId, provider: service.provider, customer, promoter, promotionTracking: promotionTracking?._id,
      message, budget, timeline,
      leadCommissionPaid: leadCommission > 0, leadCommissionAmount: leadCommission,
    });

    // Send email notification to the service provider
    try {
      const provider = await UserModel.findById(service.provider).select('email displayName firstName').lean();
      if (provider?.email) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://marketspase.com';
        const dashboardUrl = `${frontendUrl}/dashboard/stores/${service.store}/services`;
        const html = inquiryReceivedTemplate({
          providerName: provider.displayName || provider.firstName || 'there',
          serviceName: service.name,
          customerName: customer?.name || '',
          customerPhone: customer?.phone || '',
          customerEmail: customer?.email || '',
          message: message || '',
          budget: budget || '',
          timeline: timeline || '',
          dashboardUrl,
        });
        sendEmail(provider.email, `New Inquiry: ${service.name}`, html).catch(() => {});
      }
    } catch (e) { /* email failure shouldn't break the request */ }

    if (leadCommission > 0 && promoter) {
      const platformFee = Math.round(leadCommission * PLATFORM_FEE_RATE);
      const promoterPayout = leadCommission - platformFee;
      await UserModel.updateOne({ _id: promoter }, { $inc: { 'wallets.promoter.balance': promoterPayout } });
      await UserModel.updateOne({ _id: service.provider }, { $inc: { 'wallets.marketer.balance': -leadCommission } });
      if (promotionTracking) {
        await PromotionTrackingModel.updateOne({ _id: promotionTracking._id }, { $inc: { earnings: promoterPayout, conversionCount: 1 } });
      }
    }

    // Also add to marketer contacts
    if (customer.email) {
      await StoreCustomerModel.findOneAndUpdate(
        { email: customer.email, marketer: service.provider },
        {
          $set: {
            name: customer.name,
            phone: customer.phone,
            source: 'service_inquiry',
            tags: ['service_lead'],
          },
          $setOnInsert: {
            store: service.store,
            customerType: 'guest',
            lifecycleStage: 'new',
          },
        },
        { upsert: true }
      );
    }

    return res.status(201).json({ success: true, data: inquiry });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const bookService = async (req, res) => {
  try {
    const { inquiryId, amount, scheduledDate } = req.body;
    const inquiry = await ServiceInquiryModel.findById(inquiryId);
    if (!inquiry || inquiry.provider.toString() !== req.userId) return res.status(403).json({ success: false, message: 'Not authorized' });

    const booking = await ServiceBookingModel.create({
      service: inquiry.service, provider: req.userId, customer: inquiry.customerId, customerName: inquiry.customer?.name,
      customerPhone: inquiry.customer?.phone, promoter: inquiry.promoter, promotionTracking: inquiry.promotionTracking,
      inquiry: inquiryId, amount, scheduledDate, status: 'confirmed',
      commissionEarned: amount * 0.05, platformFee: amount * 0.01,
    });

    // Load service name for email
    let serviceName = 'a service';
    try {
      const svc = await ServiceModel.findById(inquiry.service).select('name').lean();
      if (svc) serviceName = svc.name;
    } catch (e) { /* continue */ }

    // Send email notification to the provider
    try {
      const provider = await UserModel.findById(req.userId).select('email displayName firstName').lean();
      if (provider?.email) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://marketspase.com';
        const storeId = (await ServiceModel.findById(inquiry.service).select('store').lean())?.store || '';
        const dashboardUrl = `${frontendUrl}/dashboard/stores/${storeId}/services`;
        const html = bookingReceivedTemplate({
          providerName: provider.displayName || provider.firstName || 'there',
          serviceName,
          customerName: inquiry.customer?.name || '',
          amount,
          scheduledDate,
          dashboardUrl,
        });
        sendEmail(provider.email, `New Booking: ${serviceName}`, html).catch(() => {});
      }
    } catch (e) { /* email failure shouldn't break the request */ }

    await ServiceInquiryModel.updateOne({ _id: inquiryId }, { $set: { status: 'booked' } });
    await ServiceModel.updateOne({ _id: inquiry.service }, { $inc: { bookingCount: 1 } });

    return res.status(201).json({ success: true, data: booking });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
