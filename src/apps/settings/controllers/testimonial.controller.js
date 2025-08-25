import { UserModel } from './../../user/models/user.model.js';
import { TestimonialModel } from './../models/testimonial.model.js';

/**
 * Create or update user testimonial
 * @param req Express request
 * @param res Express response
 */
export const createOrUpdateTestimonial = async (req, res) => {
  try {
    const { userId, message, rating = 5 } = req.body;

    // Validate input
    if (!message) {
      return res.status(400).json({ success: false, message: 'Testimonial message is required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // Get user data
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if testimonial exists
    let testimonial = await TestimonialModel.findOne({ user: userId });

    if (testimonial) {
      // Update existing testimonial
      testimonial.message = message;
      testimonial.rating = rating;
      testimonial.status = 'pending'; // Reset status on update
      await testimonial.save();
    } else {
      // Create new testimonial
      testimonial = await TestimonialModel.create({
        user: userId,
        name: `${user.name} ${user.lastname}`,
        avatar: user.avatar,
        jobTitle: user.personalInfo?.jobTitle,
        message,
        rating,
        status: 'pending'
      });

      // Add to user's testimonials array
      user.testimonials.push(testimonial._id);
      await user.save();
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
export const getTestimonials = async (req, res) => {
  try {
    const { status = 'approved', limit = 10, page = 1 } = req.query;
    //const userId = req.params; 

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
    const testimonials = await TestimonialModel.find({ status })
       .populate({
            path: 'user',
            select: 'name lastname avatar personalInfo.address.state personalInfo.address.country personalInfo.jobTitle', // Ensure jobTitle is also selected if you need it
            transform: (doc) => {
            return {
                _id: doc._id,
                name: `${doc.name} ${doc.lastname}`,
                avatar: doc.avatar,
                state: doc.personalInfo?.address?.state,   // Add state here
                country: doc.personalInfo?.address?.country, // Add country here
                jobTitle: doc.personalInfo?.jobTitle // Keep jobTitle if needed
            };
            }
        })
      .skip(options.skip)
      .limit(options.limit)
      .sort(options.sort)
      .lean();

    // Add user reaction status if authenticated
    // if (userId) {
    //   for (const testimonial of testimonials) {
    //     const reaction = testimonial.reactions.find(
    //       r => r.userId && r.userId.toString() === userId.toString()
    //     );
    //     testimonial.userReaction = reaction ? reaction.reaction : null;
        
    //     // Convert reaction userIds to strings for consistent client-side handling
    //     testimonial.reactions = testimonial.reactions.map(r => ({
    //       ...r,
    //       userId: r.userId?.toString()
    //     }));
    //   }
    // }

    const total = await TestimonialModel.countDocuments({ status });

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

/**
 * React to testimonial (like/dislike)
 * @param req Express request
 * @param res Express response
 */
export const reactToTestimonial = async (req, res) => {
  try {
    const { userId, testimonialId, reaction } = req.body; // 'like' or 'dislike'

    //console.log('reactions ', userId, testimonialId, reaction);

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
export const getUserTestimonial = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(userId)

    // Find testimonial for the specified user
    const testimonial = await TestimonialModel.findOne({ user: userId })
      .populate({
        path: 'user',
        //select: 'name lastname avatar personalInfo.address.state personalInfo.address.country',
        // transform: (doc) => ({
        //   _id: doc._id,
        //   name: `${doc.name} ${doc.lastname}`,
        //   avatar: doc.avatar,
        //   state: doc.personalInfo?.address?.state,
        //   country: doc.personalInfo?.address?.country,
        // })
      })
      .lean();

    if (!testimonial) {
      return res.status(404).json({ 
        success: false, 
        message: 'No testimonial found for this user' 
      });
    }

    // Add user reaction status if authenticated
    if (userId) {
      const reaction = testimonial.reactions.find(
        r => r.userId && r.userId.toString() === userId.toString()
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
        user: testimonial.user,
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