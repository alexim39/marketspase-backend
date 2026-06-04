import { TestimonialModel } from "../../models/testimonial/index.js";
import { UserModel } from "../../../user/models/user/index.js";

const formatAdminTestimonial = (testimonial) => {
  const item = testimonial?.toObject ? testimonial.toObject() : testimonial;

  if (!item) {
    return item;
  }

  return {
    ...item,
    user: item.user ? {
      ...item.user,
      name: item.user.displayName || item.user.username || item.user.name || "MarketSpase User",
      avatar: item.user.avatar || null,
    } : null,
  };
};

export class MongooseSettingsTestimonialRepository {
  async findTestimonials({ filter, skip, limit, sort }) {
    const testimonials = await TestimonialModel.find(filter)
      .populate({
        path: "user",
        select: "displayName username avatar personalInfo.address.state personalInfo.address.country professionalInfo.jobTitle",
        transform: (doc) => {
          if (!doc) {
            return null;
          }

          return {
            _id: doc._id,
            name: doc.displayName || doc.username || "MarketSpase User",
            username: doc.username,
            avatar: doc.avatar,
            state: doc.personalInfo?.address?.state,
            country: doc.personalInfo?.address?.country,
            jobTitle: doc.professionalInfo?.jobTitle,
          };
        },
      })
      .skip(skip)
      .limit(limit)
      .sort(sort)
      .lean();

    const total = await TestimonialModel.countDocuments(filter);

    return {
      testimonials: testimonials.map((testimonial) => ({
        ...testimonial,
        user: testimonial.user,
        _id: testimonial._id.toString(),
        reactions: testimonial.reactions || [],
      })),
      total,
    };
  }

  async findUserTestimonial(userId) {
    return TestimonialModel.findOne({
      user: userId,
      isDeleted: false,
    })
      .populate({
        path: "user",
        select: "displayName username avatar personalInfo.address.state personalInfo.address.country professionalInfo.jobTitle",
      })
      .lean();
  }

  async findRandomDashboardTestimonials(count) {
    const testimonials = await TestimonialModel.aggregate([
      { $match: { status: "approved" } },
      { $sample: { size: count } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          _id: 0,
          message: "$message",
          rating: {
            $ifNull: ["$rating", 0],
          },
          avatar: {
            $ifNull: ["$userInfo.avatar", "/img/avatar.png"],
          },
          name: "$userInfo.displayName",
          location: {
            $concat: [
              { $ifNull: ["$userInfo.personalInfo.address.city", ""] },
              ", ",
              { $ifNull: ["$userInfo.personalInfo.address.country", ""] },
            ],
          },
        },
      },
    ]);

    return testimonials.map((testimonial) => {
      const location = testimonial.location.replace(/^, |^,|^ , /g, "").trim();
      return {
        ...testimonial,
        location,
      };
    });
  }

  async findTestimonialUserById(userId) {
    return UserModel.findById(userId).select("_id").lean();
  }

  async findActiveTestimonialByUser(userId) {
    return TestimonialModel.findOne({
      user: userId,
      isDeleted: false,
    }).select("_id").lean();
  }

  async updateTestimonialSubmission({ testimonialId, message, rating, status }) {
    const testimonial = await TestimonialModel.findById(testimonialId);

    testimonial.message = message;
    testimonial.rating = rating;
    testimonial.status = status;
    await testimonial.save();

    return testimonial;
  }

  async createTestimonialSubmission({ userId, message, rating, status }) {
    return TestimonialModel.create({
      user: userId,
      message,
      rating,
      status,
    });
  }

  async addUserTestimonialReference({ userId, testimonialId }) {
    await UserModel.updateOne(
      { _id: userId, testimonials: { $ne: testimonialId } },
      { $push: { testimonials: testimonialId } },
    );
  }

  async findTestimonialReactionState(testimonialId) {
    return TestimonialModel.findById(testimonialId)
      .select("likes dislikes reactions")
      .lean();
  }

  async saveTestimonialReactionState({ testimonialId, reactions, likes, dislikes }) {
    await TestimonialModel.findByIdAndUpdate(
      testimonialId,
      {
        $set: {
          reactions,
          likes,
          dislikes,
        },
      },
    );
  }

  async removeUserTestimonialReaction({ userId, testimonialId }) {
    await UserModel.updateOne(
      { _id: userId },
      { $pull: { testimonialReactions: { testimonial: testimonialId } } },
    );
  }

  async updateUserTestimonialReaction({ userId, testimonialId, reaction }) {
    return UserModel.updateOne(
      { _id: userId, "testimonialReactions.testimonial": testimonialId },
      { $set: { "testimonialReactions.$.reaction": reaction } },
    );
  }

  async addUserTestimonialReaction({ userId, testimonialId, reaction, createdAt }) {
    await UserModel.updateOne(
      { _id: userId },
      {
        $push: {
          testimonialReactions: {
            testimonial: testimonialId,
            reaction,
            createdAt,
          },
        },
      },
    );
  }

  async findAdminTestimonials({ filter, skip, limit }) {
    const testimonials = await TestimonialModel.find(filter)
      .populate("user", "displayName username avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await TestimonialModel.countDocuments(filter);

    return {
      testimonials: testimonials.map(formatAdminTestimonial),
      total,
    };
  }

  async updateTestimonialStatus({ testimonialId, status, reviewedBy, reviewedAt }) {
    const testimonial = await TestimonialModel.findByIdAndUpdate(
      testimonialId,
      {
        status,
        reviewedBy,
        reviewedAt,
      },
      { new: true },
    ).populate("user", "displayName username avatar");

    if (!testimonial) {
      return null;
    }

    return formatAdminTestimonial(testimonial);
  }

  async updateTestimonialFeaturedState({ testimonialId, isFeatured }) {
    const testimonial = await TestimonialModel.findByIdAndUpdate(
      testimonialId,
      { isFeatured },
      { new: true },
    ).populate("user", "displayName username avatar");

    if (!testimonial) {
      return null;
    }

    return formatAdminTestimonial(testimonial);
  }

  async deleteTestimonial(testimonialId) {
    const testimonial = await TestimonialModel.findByIdAndDelete(testimonialId);

    if (!testimonial) {
      return null;
    }

    return {
      _id: testimonial._id,
      user: testimonial.user,
    };
  }

  async removeUserTestimonialReference({ userId, testimonialId }) {
    await UserModel.updateOne(
      { _id: userId },
      { $pull: { testimonials: testimonialId } },
    );
  }

  async syncUserTestimonials(userId) {
    const testimonialIds = await TestimonialModel.find({
      user: userId,
      isDeleted: false,
    }).distinct("_id");

    await UserModel.updateOne(
      { _id: userId },
      { $set: { testimonials: testimonialIds } },
    );
  }
}
