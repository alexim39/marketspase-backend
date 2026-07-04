import { StoreModel } from '../../models/store/store.model.js';
import { uploadGalleryMedia, deleteGalleryMedia } from '../../utils/gallery-cloudinary.js';
import { ensureStoreWriteAccess } from '../../services/store-authorization.service.js';

export async function uploadGallery(req, res) {
  try {
    const { storeId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files provided' });
    }

    let store;
    try {
      ({ store } = await ensureStoreWriteAccess({ storeId, req }));
    } catch (authErr) {
      return res.status(authErr.status || 403).json({ success: false, message: authErr.message || 'Not authorized' });
    }

    if (store.gallery && store.gallery.length >= 50) {
      return res.status(400).json({ success: false, message: 'Gallery limit reached (50 items max). Delete some items first.' });
    }

    const uploaded = [];
    for (const file of files) {
      try {
        const result = await uploadGalleryMedia(file.buffer, file.originalname);
        const type = file.mimetype?.startsWith('video/') ? 'video' : 'image';
        store.gallery.push({ url: result.secure_url, type, caption: '' });
        uploaded.push({ url: result.secure_url, type });
      } catch (uploadErr) {
        console.error('Failed to upload file:', file.originalname, uploadErr.message);
      }
    }

    if (uploaded.length === 0) {
      return res.status(500).json({ success: false, message: 'All uploads failed. Check file types and sizes.' });
    }

    await store.save();

    return res.status(200).json({ success: true, data: uploaded, gallery: store.gallery });
  } catch (err) {
    console.error('uploadGallery error:', err);
    return res.status(500).json({ success: false, message: 'Upload failed: ' + (err.message || 'Unknown error') });
  }
}

export async function listGallery(req, res) {
  try {
    const { storeId } = req.params;
    const store = await StoreModel.findById(storeId).select('gallery');
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });

    return res.status(200).json({ success: true, data: store.gallery || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteGalleryItem(req, res) {
  try {
    const { storeId, mediaId } = req.params;

    let store;
    try {
      ({ store } = await ensureStoreWriteAccess({ storeId, req }));
    } catch (authErr) {
      return res.status(authErr.status || 403).json({ success: false, message: authErr.message || 'Not authorized' });
    }

    const media = store.gallery.id(mediaId);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

    await deleteGalleryMedia(media.url);
    store.gallery.pull({ _id: mediaId });
    await store.save();

    return res.status(200).json({ success: true, gallery: store.gallery });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateStoreProfile(req, res) {
  try {
    const { storeId } = req.params;

    let store;
    try {
      ({ store } = await ensureStoreWriteAccess({ storeId, req }));
    } catch (authErr) {
      return res.status(authErr.status || 403).json({ success: false, message: authErr.message || 'Not authorized' });
    }

    const { businessHours, serviceAreas, faqs, certifications } = req.body;

    if (businessHours !== undefined) store.businessHours = businessHours;
    if (serviceAreas !== undefined) store.serviceAreas = serviceAreas;
    if (faqs !== undefined) store.faqs = faqs;
    if (certifications !== undefined) store.certifications = certifications;

    await store.save();

    return res.status(200).json({ success: true, data: store });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
