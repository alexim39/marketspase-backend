import { TestimonialModel } from './../models/testimonial/index.js';
import { UserModel } from '../../user/models/user/index.js';

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
export const adminGetTestimonials = async (req, res) => {
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

// Update testimonial status
export const updateTestimonialStatus = async (req, res) => {
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

// Toggle featured status
export const toggleFeatured = async (req, res) => {
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

// Delete testimonial
export const deleteTestimonial = async (req, res) => {
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

const syncUserTestimonials = async (userId) => {
  const testimonialIds = await TestimonialModel.find({ user: userId, isDeleted: false }).distinct('_id');
  await UserModel.updateOne({ _id: userId }, { $set: { testimonials: testimonialIds } });
};
