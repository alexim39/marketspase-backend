import { NewsletterModel } from '../models/newsletter.model.js';
import { UserModel } from '../../user/models/user.model.js';
import { sendEmail } from '../../../core/email.service.js';
import { newsletterEmailTemplate, newsletterPlainTextTemplate } from './email/newsletter.template.js';
import mongoose from 'mongoose';

export class NewsletterService {
  constructor() {
    // You can initialize any dependencies here
  }

  // Get all newsletters with filtering and pagination
  async getNewsletters({ status, search, page = 1, limit = 10 } = {}) {
    try {
      const query = { isDeleted: false };
      
      // Add status filter
      if (status && status !== 'all') {
        query.status = status;
      }
      
      // Add search filter
      if (search) {
        query.$or = [
          { subject: { $regex: search, $options: 'i' } },
          { previewText: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;
      
      const [newsletters, total] = await Promise.all([
        NewsletterModel.find(query)
          .populate('createdBy', 'displayName email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        NewsletterModel.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        newsletters,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        }
      };
    } catch (error) {
      console.error('Error in getNewsletters service:', error);
      throw error;
    }
  }

  // Get newsletter by ID
  async getNewsletterById(id) {
    try {
      const newsletter = await NewsletterModel.findById(id)
        .populate('createdBy', 'displayName email')
        .lean();
      
      return newsletter;
    } catch (error) {
      console.error('Error in getNewsletterById service:', error);
      throw error;
    }
  }

  // Create new newsletter
  async createNewsletter(newsletterData) {
    try {
      const newsletter = new NewsletterModel(newsletterData);
      await newsletter.save();
      
      // Populate createdBy field for response
      const populatedNewsletter = await NewsletterModel.findById(newsletter._id)
        .populate('createdBy', 'displayName email');
      
      return populatedNewsletter;
    } catch (error) {
      console.error('Error in createNewsletter service:', error);
      throw error;
    }
  }

  // Update newsletter
  async updateNewsletter(id, newsletterData) {
    try {
      const newsletter = await NewsletterModel.findByIdAndUpdate(
        id,
        { 
          ...newsletterData,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      ).populate('createdBy', 'displayName email');
      
      return newsletter;
    } catch (error) {
      console.error('Error in updateNewsletter service:', error);
      throw error;
    }
  }

  // Delete newsletter (soft delete)
  async deleteNewsletter(id) {
    try {
      const newsletter = await NewsletterModel.findByIdAndUpdate(
        id,
        { 
          isDeleted: true,
          deletedAt: new Date()
        },
        { new: true }
      );
      
      return !!newsletter;
    } catch (error) {
      console.error('Error in deleteNewsletter service:', error);
      throw error;
    }
  }

  // Duplicate newsletter - ALTERNATIVE EXPLICIT VERSION
  async duplicateNewsletter(id) {
    try {
      // Validate the ID
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('Invalid newsletter ID');
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid newsletter ID format');
      }

      const originalNewsletter = await NewsletterModel.findById(id);
      
      if (!originalNewsletter) {
        return null;
      }

      // Manually create the duplicated data without the _id
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
        status: 'draft',
        sendOption: 'draft',
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
        updatedAt: new Date()
      };

      const duplicatedNewsletter = new NewsletterModel(duplicatedData);
      await duplicatedNewsletter.save();
      
      // Populate the createdBy field for response
      const populatedNewsletter = await NewsletterModel.findById(duplicatedNewsletter._id)
        .populate('createdBy', 'displayName email');
      
      return populatedNewsletter;
    } catch (error) {
      console.error('Error in duplicateNewsletter service:', error);
      throw error;
    }
  }

  // Send newsletter
  async sendNewsletter(id) {
    try {
      const newsletter = await NewsletterModel.findById(id);
      
      if (!newsletter) {
        return { success: false, message: 'Newsletter not found' };
      }

      if (newsletter.status === 'sent') {
        return { success: false, message: 'Newsletter has already been sent' };
      }

      // Get recipients based on recipient type
      const recipients = await this.getRecipients(newsletter.recipientType, newsletter.externalEmails);
      
      if (recipients.length === 0) {
        return { success: false, message: 'No recipients found for this newsletter' };
      }

      // Update newsletter status to sending
      newsletter.status = 'sending';
      newsletter.estimatedRecipients = recipients.length;
      await newsletter.save();

      // Send emails (in production, you might want to use a queue system)
      const sendPromises = recipients.map(recipient => 
        this.sendNewsletterToRecipient(newsletter, recipient)
      );

      await Promise.all(sendPromises);

      // Update newsletter status to sent
      newsletter.status = 'sent';
      newsletter.sentDate = new Date();
      newsletter.actualRecipients = recipients.length;
      await newsletter.save();

      return { 
        success: true, 
        newsletter: await NewsletterModel.findById(id).populate('createdBy', 'displayName email')
      };
    } catch (error) {
      console.error('Error in sendNewsletter service:', error);
      
      // Update newsletter status to failed in case of error
      await NewsletterModel.findByIdAndUpdate(id, { status: 'failed' });
      
      return { success: false, message: 'Failed to send newsletter' };
    }
  }

  // Schedule newsletter
  async scheduleNewsletter(id, scheduledDate) {
    try {
      const newsletter = await NewsletterModel.findById(id);
      
      if (!newsletter) {
        return { success: false, message: 'Newsletter not found' };
      }

      if (scheduledDate <= new Date()) {
        return { success: false, message: 'Scheduled date must be in the future' };
      }

      newsletter.status = 'scheduled';
      newsletter.scheduledDate = scheduledDate;
      await newsletter.save();

      return { 
        success: true, 
        newsletter: await NewsletterModel.findById(id).populate('createdBy', 'displayName email')
      };
    } catch (error) {
      console.error('Error in scheduleNewsletter service:', error);
      return { success: false, message: 'Failed to schedule newsletter' };
    }
  }

  // Cancel scheduled newsletter
  async cancelScheduledNewsletter(id) {
    try {
      const newsletter = await NewsletterModel.findById(id);
      
      if (!newsletter) {
        return { success: false, message: 'Newsletter not found' };
      }

      if (newsletter.status !== 'scheduled') {
        return { success: false, message: 'Newsletter is not scheduled' };
      }

      newsletter.status = 'draft';
      newsletter.scheduledDate = null;
      await newsletter.save();

      return { 
        success: true, 
        newsletter: await NewsletterModel.findById(id).populate('createdBy', 'displayName email')
      };
    } catch (error) {
      console.error('Error in cancelScheduledNewsletter service:', error);
      return { success: false, message: 'Failed to cancel scheduled newsletter' };
    }
  }

  // Save as draft
  async saveAsDraft(id) {
    try {
      const newsletter = await NewsletterModel.findByIdAndUpdate(
        id,
        { 
          status: 'draft',
          scheduledDate: null
        },
        { new: true }
      ).populate('createdBy', 'displayName email');
      
      return newsletter;
    } catch (error) {
      console.error('Error in saveAsDraft service:', error);
      throw error;
    }
  }

  // Get newsletter statistics
  async getNewsletterStats() {
    try {
      const stats = await NewsletterModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
            scheduled: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
            sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
            totalSent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, '$actualRecipients', 0] } },
            avgOpenRate: { $avg: '$openRate' },
            avgClickRate: { $avg: '$clickRate' }
          }
        }
      ]);
      
      return stats[0] || {
        total: 0,
        draft: 0,
        scheduled: 0,
        sent: 0,
        totalSent: 0,
        avgOpenRate: 0,
        avgClickRate: 0
      };
    } catch (error) {
      console.error('Error in getNewsletterStats service:', error);
      throw error;
    }
  }

  // Get recipient counts for different types
  async getRecipientCounts() {
    try {
      const [allUsers, marketers, promoters] = await Promise.all([
        UserModel.countDocuments({ isActive: true, isDeleted: false }),
        UserModel.countDocuments({ role: 'marketer', isActive: true, isDeleted: false }),
        UserModel.countDocuments({ role: 'promoter', isActive: true, isDeleted: false })
      ]);
      
      return {
        all: allUsers,
        marketers,
        promoters
      };
    } catch (error) {
      console.error('Error in getRecipientCounts service:', error);
      throw error;
    }
  }

  // Validate external emails
  async validateExternalEmails(emails) {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const valid = [];
      const invalid = [];

      emails.forEach(email => {
        if (emailRegex.test(email.trim())) {
          valid.push(email.trim());
        } else {
          invalid.push(email.trim());
        }
      });

      return { valid, invalid };
    } catch (error) {
      console.error('Error in validateExternalEmails service:', error);
      throw error;
    }
  }

  // Process CSV file with emails
  async processEmailCSV(file) {
    try {
      // This would parse the CSV file and extract emails
      // For now, returning a mock implementation
      const content = file.buffer.toString();
      const lines = content.split('\n');
      const emails = [];

      lines.forEach(line => {
        const email = line.split(',')[0]?.trim();
        if (email && this.isValidEmail(email)) {
          emails.push(email);
        }
      });

      // Remove duplicates
      const uniqueEmails = [...new Set(emails)];

      return {
        emails: uniqueEmails,
        total: uniqueEmails.length,
        duplicates: emails.length - uniqueEmails.length
      };
    } catch (error) {
      console.error('Error in processEmailCSV service:', error);
      throw error;
    }
  }

  // Helper method to get recipients based on type
  async getRecipients(recipientType, externalEmails = []) {
    try {
      switch (recipientType) {
        case 'all':
          const allUsers = await UserModel.find({ 
            isActive: true, 
            isDeleted: false,
            email: { $exists: true, $ne: null }
          }).select('email displayName role');
          return allUsers;

        case 'marketers':
          const marketers = await UserModel.find({ 
            role: 'marketer', 
            isActive: true, 
            isDeleted: false,
            email: { $exists: true, $ne: null }
          }).select('email displayName role');
          return marketers;

        case 'promoters':
          const promoters = await UserModel.find({ 
            role: 'promoter', 
            isActive: true, 
            isDeleted: false,
            email: { $exists: true, $ne: null }
          }).select('email displayName role');
          return promoters;

        case 'external':
          return externalEmails.map(email => ({ email, displayName: '', role: 'external' }));

        default:
          return [];
      }
    } catch (error) {
      console.error('Error in getRecipients service:', error);
      return [];
    }
  }

  // Helper method to send newsletter to a single recipient
  async sendNewsletterToRecipient(newsletter, recipient) {
    try {
      const trackingPixelUrl = `${process.env.API_URL}/newsletters/track/open/${newsletter._id}/${recipient.email}`;
      const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe?email=${recipient.email}&newsletter=${newsletter._id}`;

      const htmlContent = newsletterEmailTemplate(newsletter, recipient, trackingPixelUrl, unsubscribeUrl);
      //const plainTextContent = newsletterPlainTextTemplate(newsletter, recipient);

      await sendEmail(
        recipient.email,
        newsletter.subject,
        htmlContent
      );

      // Update delivery status
      await NewsletterModel.findByIdAndUpdate(newsletter._id, {
        $push: {
          deliveryStatus: {
            email: recipient.email,
            status: 'sent',
            deliveredAt: new Date(),
            serviceProvider: 'sendgrid' // or your email service
          }
        }
      });

    } catch (error) {
      console.error(`Error sending newsletter to ${recipient.email}:`, error);
      
      // Update delivery status as failed
      await NewsletterModel.findByIdAndUpdate(newsletter._id, {
        $push: {
          deliveryStatus: {
            email: recipient.email,
            status: 'failed',
            failureReason: error.message,
            serviceProvider: 'sendgrid'
          }
        }
      });
    }
  }

  // Helper method to validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}