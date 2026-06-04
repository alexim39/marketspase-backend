import { GetTestimonialsDto } from '../application/dto/get-testimonials.dto.js';
import { GetTestimonialsUseCase } from '../application/use-cases/get-testimonials.use-case.js';
import { GetUserTestimonialDto } from '../application/dto/get-user-testimonial.dto.js';
import { GetUserTestimonialUseCase } from '../application/use-cases/get-user-testimonial.use-case.js';
import { GetRandomDashboardTestimonialsDto } from '../application/dto/get-random-dashboard-testimonials.dto.js';
import { GetRandomDashboardTestimonialsUseCase } from '../application/use-cases/get-random-dashboard-testimonials.use-case.js';
import { ReactToTestimonialDto } from '../application/dto/react-to-testimonial.dto.js';
import { ReactToTestimonialUseCase } from '../application/use-cases/react-to-testimonial.use-case.js';
import { CreateOrUpdateTestimonialDto } from '../application/dto/create-or-update-testimonial.dto.js';
import { CreateOrUpdateTestimonialUseCase } from '../application/use-cases/create-or-update-testimonial.use-case.js';
import {
  SettingsTestimonialNotFoundError,
  SettingsUserNotFoundError,
  SettingsValidationError,
} from '../domain/errors/settings.errors.js';
import { MongooseSettingsTestimonialRepository } from '../infrastructure/repositories/mongoose-settings-testimonial.repository.js';
import { UserModel } from './../../user/models/user/index.js';
import { TestimonialModel } from './../models/testimonial/index.js';
import { ensureSelfOrAdmin, getAuthenticatedUserId } from '../../../shared/utils/request-auth.util.js';

const settingsTestimonialRepository = new MongooseSettingsTestimonialRepository();

const getTestimonialsUseCase = new GetTestimonialsUseCase({
  settingsTestimonialRepository,
});

const getUserTestimonialUseCase = new GetUserTestimonialUseCase({
  settingsTestimonialRepository,
});

const getRandomDashboardTestimonialsUseCase = new GetRandomDashboardTestimonialsUseCase({
  settingsTestimonialRepository,
});

const reactToTestimonialUseCase = new ReactToTestimonialUseCase({
  settingsTestimonialRepository,
});

const createOrUpdateTestimonialUseCase = new CreateOrUpdateTestimonialUseCase({
  settingsTestimonialRepository,
});

/**
 * Create or update user testimonial
 * @param req Express request
 * @param res Express response
 */
export const legacyCreateOrUpdateTestimonial = async (req, res) => {
  try {
    const authenticatedUserId = getAuthenticatedUserId(req);
    const candidateUserId = req.body.userId || authenticatedUserId;
    const { message, rating = 5 } = req.body;

    if (!authenticatedUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!ensureSelfOrAdmin(req, candidateUserId, res, 'You can only manage your own testimonial')) {
      return;
    }

    // Validate input
    if (!message) {
      return res.status(400).json({ success: false, message: 'Testimonial message is required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // Get user data
    const user = await UserModel.findById(candidateUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if testimonial exists
    let testimonial = await TestimonialModel.findOne({ user: candidateUserId, isDeleted: false });

    if (testimonial) {
      // Update existing testimonial
      testimonial.message = message;
      testimonial.rating = rating;
      testimonial.status = 'pending'; // Reset status on update
      await testimonial.save();
    } else {
      // Create new testimonial
      testimonial = await TestimonialModel.create({
        user: candidateUserId,
        message,
        rating,
        status: 'pending'
      });

      // Add to user's testimonials array
      await UserModel.updateOne(
        { _id: candidateUserId, testimonials: { $ne: testimonial._id } },
        { $push: { testimonials: testimonial._id } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Testimonial submitted successfully and pending approval',
      testimonial: {
        _id: testimonial._id,
        message: testimonial.message,
        rating: testimonial.rating,
        status: testimonial.status,
        createdAt: testimonial.createdAt
      }
    });

  } catch (error) {
    console.error('Error in createOrUpdateTestimonial:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


/**
 * Get testimonials with user reactions and populated user data
 * @param req Express request
 * @param res Express response
 */
export const legacyGetTestimonials = async (req, res) => {
  try {
    const { status = 'approved', limit = 10, page = 1 } = req.query;

    // Validate status
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status filter' });
    }

    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 }
    };

    // Get testimonials with populated user data
    const testimonials = await TestimonialModel.find({ status, isDeleted: false })
       .populate({
            path: 'user',
            select: 'displayName username avatar personalInfo.address.state personalInfo.address.country professionalInfo.jobTitle',
            transform: (doc) => {
            if (!doc) {
                return null;
            }
            return {
                _id: doc._id,
                name: doc.displayName || doc.username || 'MarketSpase User',
                username: doc.username,
                avatar: doc.avatar,
                state: doc.personalInfo?.address?.state,
                country: doc.personalInfo?.address?.country,
                jobTitle: doc.professionalInfo?.jobTitle
            };
            }
        })
      .skip(options.skip)
      .limit(options.limit)
      .sort(options.sort)
      .lean();

    const total = await TestimonialModel.countDocuments({ status, isDeleted: false });

    res.status(200).json({
      success: true,
      testimonials: testimonials.map(t => ({
        ...t,
        user: t.user, // Already transformed in populate
        _id: t._id.toString(),
        reactions: t.reactions || [] // Ensure reactions array exists
      })),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / options.limit),
        limit: options.limit
      }
    });

  } catch (error) {
    console.error('Error in getTestimonials:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const createOrUpdateTestimonial = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyCreateOrUpdateTestimonial(req, res);
  }

  try {
    const authenticatedUserId = getAuthenticatedUserId(req);
    const candidateUserId = req.body.userId || authenticatedUserId;

    if (!authenticatedUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!ensureSelfOrAdmin(req, candidateUserId, res, 'You can only manage your own testimonial')) {
      return;
    }

    const result = await createOrUpdateTestimonialUseCase.execute(
      CreateOrUpdateTestimonialDto.fromRequest({
        body: req.body,
        candidateUserId,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }

    if (error instanceof SettingsUserNotFoundError) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.error('Error in createOrUpdateTestimonial:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getTestimonials = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyGetTestimonials(req, res);
  }

  try {
    const result = await getTestimonialsUseCase.execute(
      GetTestimonialsDto.fromRequest({
        query: req.query,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error('Error in getTestimonials:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * React to testimonial (like/dislike)
 * @param req Express request
 * @param res Express response
 */
export const legacyReactToTestimonial = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { testimonialId, reaction } = req.body; // 'like' or 'dislike'

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Validate reaction
    if (!['like', 'dislike'].includes(reaction)) {
      return res.status(400).json({ success: false, message: 'Invalid reaction type' });
    }

    // Find testimonial
    const testimonial = await TestimonialModel.findById(testimonialId);
    if (!testimonial) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }

    // Check if user already reacted to this testimonial (in the testimonial's own reactions array)
    const existingReactionIndex = testimonial.reactions.findIndex(
      r => r.userId.toString() === userId.toString()
    );

    let userReactionStatus = null; // To store the final reaction status for the response
    let likesChange = 0;
    let dislikesChange = 0;

    if (existingReactionIndex >= 0) {
      // User already reacted - update existing reaction on the testimonial
      const existingReactionType = testimonial.reactions[existingReactionIndex].reaction;

      if (existingReactionType === reaction) {
        // User clicked the same reaction type again: remove their reaction
        testimonial.reactions.splice(existingReactionIndex, 1);
        if (reaction === 'like') {
          likesChange = -1;
        } else {
          dislikesChange = -1;
        }
        userReactionStatus = null; // Reaction removed
      } else {
        // User changed their reaction type (e.g., from like to dislike)
        testimonial.reactions[existingReactionIndex].reaction = reaction;
        if (existingReactionType === 'like') {
          likesChange = -1; // Remove old like
          dislikesChange = 1; // Add new dislike
        } else {
          likesChange = 1; // Add new like
          dislikesChange = -1; // Remove old dislike
        }
        userReactionStatus = reaction; // Reaction changed
      }
    } else {
      // User is adding a new reaction to this testimonial
      testimonial.reactions.push({ userId, reaction, createdAt: new Date() }); // Add createdAt for consistency
      if (reaction === 'like') {
        likesChange = 1;
      } else {
        dislikesChange = 1;
      }
      userReactionStatus = reaction; // New reaction added
    }

    // Update testimonial counts and save
    testimonial.likes += likesChange;
    testimonial.dislikes += dislikesChange;
    await testimonial.save();

    // --- Start: Corrected logic for User Model Update ---
    if (userReactionStatus === null) {
        // Reaction was removed from the testimonial, so remove it from the user's record
        await UserModel.updateOne(
            { _id: userId },
            { $pull: { testimonialReactions: { testimonial: testimonialId } } }
        );
    } else {
        // Reaction was added or changed, attempt to update first
        const updateResult = await UserModel.updateOne(
            { _id: userId, 'testimonialReactions.testimonial': testimonialId },
            { $set: { 'testimonialReactions.$.reaction': userReactionStatus } }
        );

        if (updateResult.modifiedCount === 0) {
            // If no existing reaction was found and updated (modifiedCount is 0),
            // then push a new reaction
            await UserModel.updateOne(
                { _id: userId },
                { $push: { testimonialReactions: { testimonial: testimonialId, reaction: userReactionStatus, createdAt: new Date() } } }
            );
        }
    }
    // --- End: Corrected logic for User Model Update ---

    res.status(200).json({
      success: true,
      message: 'Reaction updated successfully',
      likes: testimonial.likes,
      dislikes: testimonial.dislikes,
      userReaction: userReactionStatus // This will be 'like', 'dislike', or null
    });

  } catch (error) {
    console.error('Error in reactToTestimonial:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


/**
 * Get a single testimonial for a specific user
 * @param req Express request
 * @param res Express response
 */
export const legacyGetUserTestimonial = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = getAuthenticatedUserId(req);

    if (currentUserId && !ensureSelfOrAdmin(req, userId, res, 'You can only access your own testimonial')) {
      return;
    }

    // Find testimonial for the specified user
    const testimonial = await TestimonialModel.findOne({ user: userId, isDeleted: false })
      .populate({
        path: 'user',
        select: 'displayName username avatar personalInfo.address.state personalInfo.address.country professionalInfo.jobTitle',
      })
      .lean();

    if (!testimonial) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    // Add viewer reaction status if authenticated
    if (currentUserId) {
      const reaction = testimonial.reactions.find(
        r => r.userId && r.userId.toString() === currentUserId.toString()
      );
      testimonial.userReaction = reaction ? reaction.reaction : null;
      
      // Convert reaction userIds to strings
      testimonial.reactions = testimonial.reactions.map(r => ({
        ...r,
        userId: r.userId?.toString()
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        ...testimonial,
        _id: testimonial._id.toString(),
        user: testimonial.user ? {
          _id: testimonial.user._id,
          name: testimonial.user.displayName || testimonial.user.username || 'MarketSpase User',
          username: testimonial.user.username,
          avatar: testimonial.user.avatar,
          state: testimonial.user.personalInfo?.address?.state,
          country: testimonial.user.personalInfo?.address?.country,
          jobTitle: testimonial.user.professionalInfo?.jobTitle,
        } : null,
        reactions: testimonial.reactions || []
      }
    });

  } catch (error) {
    console.error('Error in getUserTestimonial:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const reactToTestimonial = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyReactToTestimonial(req, res);
  }

  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await reactToTestimonialUseCase.execute(
      ReactToTestimonialDto.fromRequest({
        body: req.body,
        userId,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }

    if (error instanceof SettingsTestimonialNotFoundError) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }

    console.error('Error in reactToTestimonial:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getUserTestimonial = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyGetUserTestimonial(req, res);
  }

  try {
    const { userId } = req.params;
    const currentUserId = getAuthenticatedUserId(req);

    if (currentUserId && !ensureSelfOrAdmin(req, userId, res, 'You can only access your own testimonial')) {
      return;
    }

    const result = await getUserTestimonialUseCase.execute(
      GetUserTestimonialDto.fromRequest({
        params: req.params,
        currentUserId,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in getUserTestimonial:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};


/**
 * Controller to fetch a random sample of approved testimonials with user details.
 */
export const legacyGetRandomTestimonials = async (req, res) => {
  try {
    const count = parseInt(req.query.count, 10) || 10; // Default to 10 if count is not provided or invalid

    // Use Mongoose Aggregation to find, join, and format the data in one query.
    const randomTestimonials = await TestimonialModel.aggregate([
      // 1. Match only testimonials with an 'approved' status.
      { $match: { status: 'approved' } },

      // 2. Randomly select the specified number of documents from the matched set.
      { $sample: { size: count } },
      
      // 3. Join with the 'users' collection using the 'user' field.
      {
        $lookup: {
          from: 'users', // Mongoose pluralizes the model name 'User' to 'users'
          localField: 'user', // Field from the testimonial model
          foreignField: '_id', // Field from the user model
          as: 'userInfo' // The array to store the joined user data
        }
      },

      // 4. Deconstruct the userInfo array created by $lookup.
      // This is necessary because $lookup always returns an array, and we expect only one user.
      { $unwind: '$userInfo' },

      // 5. Reshape the output documents to the desired format.
      {
        $project: {
          _id: 0, // Exclude the original testimonial ID
          message: '$message', // Get the message from the testimonial document
          rating: { 
            $ifNull: ['$rating', 0] // Get the rating or default to 0 if not present
          },
          avatar: { 
            $ifNull: ['$userInfo.avatar', '/img/avatar.png'] // Get user's avatar or a default
          },
          name: '$userInfo.displayName', // Get user's display name
          location: {
            $concat: [
              { $ifNull: ['$userInfo.personalInfo.address.city', ''] },
              ', ',
              { $ifNull: ['$userInfo.personalInfo.address.country', ''] }
            ]
          },
        }
      },
    ]);

    // Post-process to handle location formatting (e.g., remove leading comma if city is missing)
    const formattedTestimonials = randomTestimonials.map(testimonial => {
      let location = testimonial.location.replace(/^, |^,|^ , /g, '').trim();
      return {
        ...testimonial,
        location: location
      };
    });

    res.status(200).json({
      data: formattedTestimonials,
      success: true,
    });
  } catch (error) {
    console.error('Error in getRandomTestimonials:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getRandomTestimonials = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyGetRandomTestimonials(req, res);
  }

  try {
    const result = await getRandomDashboardTestimonialsUseCase.execute(
      GetRandomDashboardTestimonialsDto.fromRequest({
        query: req.query,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in getRandomTestimonials:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
