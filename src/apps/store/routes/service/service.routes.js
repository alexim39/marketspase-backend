import express from 'express';
import { getStoreServices, discoverServices, submitInquiry, bookService } from '../../controllers/service/service.controller.js';
import { getPromoterStoreServices } from '../../controllers/service/get-promoter-store-services.controller.js';
import { suggestService } from '../../controllers/service/suggest-service.controller.js';
import { activateSubscription } from '../../controllers/service/subscription.controller.js';
import { authenticate } from '../../../../shared/middleware/auth.middleware.js';
import { cloudinaryMediaUpload } from '../../../../core/cloudinary.service.js';
import { uploadToCloudinary } from '../../utils/cloudinary.js';
import fs from 'fs';

const router = express.Router();

router.get('/discover', discoverServices);
router.post('/inquiry', submitInquiry);

router.use(authenticate);

// Specific routes before parameterized ones
router.post('/suggest', suggestService);
router.get('/list/promoter', getPromoterStoreServices);
router.post('/:serviceId/view', async (req, res) => {
  try {
    await (await import('../../models/service/service.model.js')).ServiceModel.updateOne(
      { _id: req.params.serviceId }, { $inc: { viewCount: 1 } }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/:storeId/create', cloudinaryMediaUpload.array('files', 10), async (req, res) => {
  try {
    const { storeId } = req.params;
    const ServiceModel = (await import('../../models/service/service.model.js')).ServiceModel;
    const StoreModel = (await import('../../models/store/index.js')).StoreModel;
    const store = await StoreModel.findOne({ _id: storeId, owner: req.userId });
    if (!store || store.type !== 'service') return res.status(400).json({ success: false, message: 'Invalid service store' });

    const data = req.body.data ? JSON.parse(req.body.data) : req.body;
    const media = [];
    if (req.files?.length) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.path, 'service-media');
          media.push({
            url: result?.secure_url || result?.url,
            type: file.mimetype?.startsWith('video') ? 'video' : 'image',
          });
          // Clean up temp file
          fs.unlink(file.path, () => {});
        } catch (e) {
          console.error('Cloudinary upload failed:', e.message);
        }
      }
    }

    const service = await ServiceModel.create({
      store: storeId, provider: req.userId, ...data, media,
    });
    return res.status(201).json({ success: true, data: service });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
});
router.get('/:storeId/list', getStoreServices);

router.get('/:storeId/:serviceId', async (req, res) => {
  try {
    const service = await (await import('../../models/service/service.model.js')).ServiceModel.findOne({
      _id: req.params.serviceId, store: req.params.storeId, provider: req.userId,
    }).lean();
    return res.json({ success: true, data: service });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
});

router.put('/:storeId/:serviceId', cloudinaryMediaUpload.array('files', 10), async (req, res) => {
  try {
    const body = req.body.data ? JSON.parse(req.body.data) : req.body;
    const update = {};
    // Parse multipart JSON data if present
    if (typeof body.isPublished === 'boolean') { update.isPublished = body.isPublished; if (body.isPublished) update.promotionStartDate = new Date(); }
    if (body.name) update.name = body.name;
    if (body.description !== undefined) update.description = body.description;
    if (body.category) update.category = body.category;
    if (body.pricingType) update.pricingType = body.pricingType;
    if (body.price !== undefined) update.price = body.price;
    if (body.hourlyRate !== undefined) update.hourlyRate = body.hourlyRate;
    if (body.packages) update.packages = body.packages;
    if (body.deliveryTime !== undefined) update.deliveryTime = body.deliveryTime;
    if (body.includes) update.includes = body.includes;
    if (body.location) update.location = body.location;
    if (body.affiliate) update.affiliate = body.affiliate;
    if (body.acceptsQuotes !== undefined) update.acceptsQuotes = body.acceptsQuotes;
    if (body.availability) update.availability = body.availability;
    if (body.slotsPerWeek !== undefined) update.slotsPerWeek = Number(body.slotsPerWeek);

    if (req.files?.length) {
      const newMedia = [];
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.path, 'service-media');
          newMedia.push({
            url: result?.secure_url || result?.url,
            type: file.mimetype?.startsWith('video') ? 'video' : 'image',
          });
          fs.unlink(file.path, () => {});
        } catch (e) { console.error('Cloudinary upload failed:', e.message); }
      }
      if (newMedia.length) update.media = newMedia;
    }

    const service = await (await import('../../models/service/service.model.js')).ServiceModel.findOneAndUpdate(
      { _id: req.params.serviceId, store: req.params.storeId, provider: req.userId },
      { $set: update }, { new: true }
    ).lean();
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    return res.json({ success: true, data: service });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
});

router.post('/book', bookService);
router.post('/subscribe', activateSubscription);

export default router;
