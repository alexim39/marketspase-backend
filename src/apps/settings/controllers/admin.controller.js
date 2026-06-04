import { GetAdminTestimonialsDto } from '../application/dto/get-admin-testimonials.dto.js';
import { GetAdminTestimonialsUseCase } from '../application/use-cases/get-admin-testimonials.use-case.js';
import { UpdateTestimonialStatusDto } from '../application/dto/update-testimonial-status.dto.js';
import { UpdateTestimonialStatusUseCase } from '../application/use-cases/update-testimonial-status.use-case.js';
import { UpdateTestimonialFeaturedStateDto } from '../application/dto/update-testimonial-featured-state.dto.js';
import { UpdateTestimonialFeaturedStateUseCase } from '../application/use-cases/update-testimonial-featured-state.use-case.js';
import { DeleteTestimonialDto } from '../application/dto/delete-testimonial.dto.js';
import { DeleteTestimonialUseCase } from '../application/use-cases/delete-testimonial.use-case.js';
import {
  SettingsTestimonialNotFoundError,
  SettingsValidationError,
} from '../domain/errors/settings.errors.js';
import { MongooseSettingsTestimonialRepository } from '../infrastructure/repositories/mongoose-settings-testimonial.repository.js';
import { TestimonialModel } from './../models/testimonial/index.js';
import { UserModel } from '../../user/models/user/index.js';

const settingsTestimonialRepository = new MongooseSettingsTestimonialRepository();

const getAdminTestimonialsUseCase = new GetAdminTestimonialsUseCase({
  settingsTestimonialRepository,
});

const updateTestimonialStatusUseCase = new UpdateTestimonialStatusUseCase({
  settingsTestimonialRepository,
});

const updateTestimonialFeaturedStateUseCase = new UpdateTestimonialFeaturedStateUseCase({
  settingsTestimonialRepository,
});

const deleteTestimonialUseCase = new DeleteTestimonialUseCase({
  settingsTestimonialRepository,
});

const formatAdminTestimonial = (testimonial) => {
  const item = testimonial?.toObject ? testimonial.toObject() : testimonial;
  if (!item) {
    return item;
  }

  return {
    ...item,
    user: item.user ? {
      ...item.user,
      name: item.user.displayName || item.user.username || item.user.name || 'MarketSpase User',
      avatar: item.user.avatar || null,
    } : null,
  };
};

// Get all testimonials with optional filtering
export const legacyAdminGetTestimonials = async (req, res) => {
  try {
    const { status, rating, featured, page = 1, limit = 10 } = req.query;

    
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (rating && rating !== 'all') {
      query.rating = parseInt(rating);
    }
    
    if (featured !== undefined) {
      query.isFeatured = featured === 'true';
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const testimonials = await TestimonialModel.find(query)
      .populate('user', 'displayName username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    const total = await TestimonialModel.countDocuments(query);
    
    res.status(200).json({
      data: testimonials.map(formatAdminTestimonial),
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total,
      success: true, 
      message: 'Testimonials found'
    });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ success: true, message: 'Server error while fetching testimonials' });
  }
};

export const adminGetTestimonials = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyAdminGetTestimonials(req, res);
  }

  try {
    const result = await getAdminTestimonialsUseCase.execute(
      GetAdminTestimonialsDto.fromRequest({
        query: req.query,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    return res.status(500).json({ success: true, message: 'Server error while fetching testimonials' });
  }
};

// Update testimonial status
export const legacyUpdateTestimonialStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    
    const testimonial = await TestimonialModel.findByIdAndUpdate(
      id,
      {
        status,
        reviewedBy: req.user?._id,
        reviewedAt: new Date(),
      },
      { new: true }
    ).populate('user', 'displayName username avatar');
    
    if (!testimonial) {
      return res.status(404).json({success: false,  message: 'Testimonial not found' });
    }
    
    if (testimonial?.user?._id) {
      await syncUserTestimonials(testimonial.user._id);
    }

    res.json(formatAdminTestimonial(testimonial));
  } catch (error) {
    console.error('Error updating testimonial status:', error);
    res.status(500).json({ success: false, message: 'Server error while updating testimonial status' });
  }
};

export const updateTestimonialStatus = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyUpdateTestimonialStatus(req, res);
  }

  try {
    const result = await updateTestimonialStatusUseCase.execute(
      UpdateTestimonialStatusDto.fromRequest({
        params: req.params,
        body: req.body,
        user: req.user,
      }),
    );

    return res.json(result);
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }

    if (error instanceof SettingsTestimonialNotFoundError) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }

    console.error('Error updating testimonial status:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating testimonial status' });
  }
};

// Toggle featured status
export const legacyToggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const { isFeatured } = req.body;
    
    const testimonial = await TestimonialModel.findByIdAndUpdate(
      id,
      { isFeatured },
      { new: true }
    ).populate('user', 'displayName username avatar');
    
    if (!testimonial) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }
    
    res.json(formatAdminTestimonial(testimonial));
  } catch (error) {
    console.error('Error toggling featured status:', error);
    res.status(500).json({ success: false, message: 'Server error while toggling featured status' });
  }
};

export const toggleFeatured = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyToggleFeatured(req, res);
  }

  try {
    const result = await updateTestimonialFeaturedStateUseCase.execute(
      UpdateTestimonialFeaturedStateDto.fromRequest({
        params: req.params,
        body: req.body,
      }),
    );

    return res.json(result);
  } catch (error) {
    if (error instanceof SettingsTestimonialNotFoundError) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }

    console.error('Error toggling featured status:', error);
    return res.status(500).json({ success: false, message: 'Server error while toggling featured status' });
  }
};

// Delete testimonial
export const legacyDeleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    
    const testimonial = await TestimonialModel.findByIdAndDelete(id);
    
    if (!testimonial) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }
    
    if (testimonial?.user) {
      await UserModel.updateOne(
        { _id: testimonial.user },
        { $pull: { testimonials: testimonial._id } }
      );
    }

    res.json({ success: true, message: 'Testimonial deleted successfully' });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting testimonial' });
  }
};

export const deleteTestimonial = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyDeleteTestimonial(req, res);
  }

  try {
    const result = await deleteTestimonialUseCase.execute(
      DeleteTestimonialDto.fromRequest({
        params: req.params,
      }),
    );

    return res.json(result);
  } catch (error) {
    if (error instanceof SettingsTestimonialNotFoundError) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }

    console.error('Error deleting testimonial:', error);
    return res.status(500).json({ success: false, message: 'Server error while deleting testimonial' });
  }
};

const syncUserTestimonials = async (userId) => {
  const testimonialIds = await TestimonialModel.find({ user: userId, isDeleted: false }).distinct('_id');
  await UserModel.updateOne({ _id: userId }, { $set: { testimonials: testimonialIds } });
};
