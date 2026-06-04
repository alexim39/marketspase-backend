import { NewsletterModel } from "../../models/index.js";
import mongoose from "mongoose";

export class MongooseNewsletterRepository {
  async findNewsletters({ filter, sort, skip, limit }) {
    return NewsletterModel.find(filter)
      .populate("createdBy", "displayName email")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countByFilter(filter) {
    return NewsletterModel.countDocuments(filter);
  }

  async create(newsletterData) {
    const newsletter = new NewsletterModel(newsletterData);
    await newsletter.save();

    return NewsletterModel.findById(newsletter._id)
      .populate("createdBy", "displayName email");
  }

  async findById(id) {
    return NewsletterModel.findById(id)
      .populate("createdBy", "displayName email")
      .lean();
  }

  async duplicateById(id) {
    if (!id || id === "undefined" || id === "null") {
      throw new Error("Invalid newsletter ID");
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid newsletter ID format");
    }

    const originalNewsletter = await NewsletterModel.findById(id);
    if (!originalNewsletter) {
      return null;
    }

    const duplicatedData = {
      title: `${originalNewsletter.title} (Copy)`,
      subject: `${originalNewsletter.subject} (Copy)`,
      previewText: originalNewsletter.previewText,
      content: originalNewsletter.content,
      htmlContent: originalNewsletter.htmlContent,
      plainTextContent: originalNewsletter.plainTextContent,
      recipientType: originalNewsletter.recipientType,
      externalEmails: originalNewsletter.externalEmails ? [...originalNewsletter.externalEmails] : [],
      estimatedRecipients: originalNewsletter.estimatedRecipients,
      status: "draft",
      sendOption: "draft",
      scheduledDate: null,
      sentDate: null,
      openRate: 0,
      clickRate: 0,
      totalOpens: 0,
      totalClicks: 0,
      uniqueOpens: 0,
      uniqueClicks: 0,
      bounceRate: 0,
      complaintRate: 0,
      unsubscribes: 0,
      engagement: [],
      deliveryStatus: [],
      contentVersions: originalNewsletter.contentVersions ? [...originalNewsletter.contentVersions] : [],
      currentVersion: originalNewsletter.currentVersion,
      campaignId: originalNewsletter.campaignId,
      tags: originalNewsletter.tags ? [...originalNewsletter.tags] : [],
      createdBy: originalNewsletter.createdBy,
      updatedBy: originalNewsletter.updatedBy,
      isActive: true,
      isDeleted: false,
      serviceProvider: originalNewsletter.serviceProvider,
      templateId: originalNewsletter.templateId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const duplicatedNewsletter = new NewsletterModel(duplicatedData);
    await duplicatedNewsletter.save();

    return NewsletterModel.findById(duplicatedNewsletter._id)
      .populate("createdBy", "displayName email");
  }

  async updateById(id, newsletterData) {
    return NewsletterModel.findByIdAndUpdate(
      id,
      {
        ...newsletterData,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true },
    ).populate("createdBy", "displayName email");
  }

  async saveAsDraftById(id) {
    return NewsletterModel.findByIdAndUpdate(
      id,
      {
        status: "draft",
        scheduledDate: null,
      },
      { new: true },
    ).populate("createdBy", "displayName email");
  }

  async scheduleById(id, scheduledDate) {
    const newsletter = await NewsletterModel.findById(id);
    if (!newsletter) {
      return null;
    }

    newsletter.status = "scheduled";
    newsletter.scheduledDate = scheduledDate;
    await newsletter.save();

    return NewsletterModel.findById(id).populate("createdBy", "displayName email");
  }

  async markSendingById(id, estimatedRecipients) {
    const newsletter = await NewsletterModel.findById(id);
    if (!newsletter) {
      return null;
    }

    newsletter.status = "sending";
    newsletter.estimatedRecipients = estimatedRecipients;
    await newsletter.save();

    return newsletter;
  }

  async markSentById(id, actualRecipients) {
    const newsletter = await NewsletterModel.findById(id);
    if (!newsletter) {
      return null;
    }

    newsletter.status = "sent";
    newsletter.sentDate = new Date();
    newsletter.actualRecipients = actualRecipients;
    await newsletter.save();

    return NewsletterModel.findById(id).populate("createdBy", "displayName email");
  }

  async markFailedById(id) {
    return NewsletterModel.findByIdAndUpdate(id, { status: "failed" });
  }

  async addDeliveryStatusById(id, deliveryStatus) {
    return NewsletterModel.findByIdAndUpdate(id, {
      $push: {
        deliveryStatus,
      },
    });
  }

  async cancelScheduleById(id) {
    const newsletter = await NewsletterModel.findById(id);
    if (!newsletter) {
      return null;
    }

    newsletter.status = "draft";
    newsletter.scheduledDate = null;
    await newsletter.save();

    return NewsletterModel.findById(id).populate("createdBy", "displayName email");
  }

  async softDeleteById(id) {
    const newsletter = await NewsletterModel.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      { new: true },
    );

    return Boolean(newsletter);
  }

  async getStats() {
    return NewsletterModel.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          scheduled: { $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] } },
          sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
          totalSent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, "$actualRecipients", 0] } },
          avgOpenRate: { $avg: "$openRate" },
          avgClickRate: { $avg: "$clickRate" },
        },
      },
    ]);
  }
}
