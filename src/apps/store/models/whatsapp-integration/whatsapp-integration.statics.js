import { ERROR_MESSAGES } from "./whatsapp-integration.constants.js";

export const setupWhatsAppIntegrationStatics = (schema) => {
  // Find or create integration for a store
  schema.statics.findOrCreate = async function(storeId) {
    let integration = await this.findOne({ store: storeId });
    
    if (!integration) {
      integration = await this.create({
        store: storeId,
        templates: [],
        quickReplies: [],
        autoResponses: [],
        businessProfile: {},
        stats: {
          messagesSent: 0,
          templatesUsed: 0,
          autoResponsesTriggered: 0,
          quickRepliesUsed: 0
        }
      });
    }
    
    return integration;
  };

  // Get integration with populated store
  schema.statics.getWithStore = async function(storeId) {
    return this.findOne({ store: storeId })
      .populate('store', 'name logo storeLink owner');
  };

  // Get all integrations for stores owned by a user
  schema.statics.getByUser = async function(userId) {
    const StoreModel = mongoose.model('Store');
    
    const stores = await StoreModel.find({ owner: userId }).distinct('_id');
    
    return this.find({ store: { $in: stores } })
      .populate('store', 'name logo storeLink');
  };

  // Get integrations with active webhooks
  schema.statics.getWithActiveWebhooks = function() {
    return this.find({ 'webhook.isActive': true })
      .populate('store', 'name storeLink');
  };

  // Get statistics across all integrations
  schema.statics.getPlatformStats = async function() {
    const stats = await this.aggregate([
      {
        $group: {
          _id: null,
          totalIntegrations: { $sum: 1 },
          totalTemplates: { $sum: { $size: '$templates' } },
          totalActiveTemplates: { 
            $sum: {
              $size: {
                $filter: {
                  input: '$templates',
                  as: 'template',
                  cond: { $eq: ['$$template.isActive', true] }
                }
              }
            }
          },
          totalQuickReplies: { $sum: { $size: '$quickReplies' } },
          totalAutoResponses: { $sum: { $size: '$autoResponses' } },
          totalMessagesSent: { $sum: '$stats.messagesSent' },
          totalTemplatesUsed: { $sum: '$stats.templatesUsed' }
        }
      }
    ]);

    return stats[0] || {
      totalIntegrations: 0,
      totalTemplates: 0,
      totalActiveTemplates: 0,
      totalQuickReplies: 0,
      totalAutoResponses: 0,
      totalMessagesSent: 0,
      totalTemplatesUsed: 0
    };
  };

  // Get template usage analytics
  schema.statics.getTemplateAnalytics = async function() {
    const analytics = await this.aggregate([
      { $unwind: '$templates' },
      {
        $group: {
          _id: {
            category: '$templates.category',
            status: '$templates.status'
          },
          count: { $sum: 1 },
          templates: { $push: '$templates.name' }
        }
      },
      { $sort: { '_id.category': 1, count: -1 } }
    ]);

    return analytics;
  };

  // Search templates across integrations
  schema.statics.searchTemplates = async function(query, options = {}) {
    const { limit = 20, skip = 0 } = options;

    const results = await this.aggregate([
      { $unwind: '$templates' },
      {
        $match: {
          $or: [
            { 'templates.name': { $regex: query, $options: 'i' } },
            { 'templates.message': { $regex: query, $options: 'i' } }
          ]
        }
      },
      {
        $lookup: {
          from: 'stores',
          localField: 'store',
          foreignField: '_id',
          as: 'storeInfo'
        }
      },
      { $unwind: '$storeInfo' },
      {
        $project: {
          template: '$templates',
          store: {
            id: '$storeInfo._id',
            name: '$storeInfo.name',
            logo: '$storeInfo.logo',
            storeLink: '$storeInfo.storeLink'
          }
        }
      },
      { $skip: skip },
      { $limit: limit }
    ]);

    const total = await this.aggregate([
      { $unwind: '$templates' },
      {
        $match: {
          $or: [
            { 'templates.name': { $regex: query, $options: 'i' } },
            { 'templates.message': { $regex: query, $options: 'i' } }
          ]
        }
      },
      { $count: 'total' }
    ]);

    return {
      templates: results,
      pagination: {
        total: total[0]?.total || 0,
        limit,
        skip,
        hasMore: skip + results.length < (total[0]?.total || 0)
      }
    };
  };

  // Bulk update template status
  schema.statics.bulkUpdateTemplateStatus = async function(templateIds, isActive) {
    // This would need to find integrations containing these templates
    // For now, we'll return a placeholder
    return {
      modifiedCount: 0,
      message: 'Bulk update not implemented'
    };
  };
};