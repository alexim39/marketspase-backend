import { CONTACT_STATUS, CONTACT_PRIORITY } from "./contact.constants.js";

export const setupContactStatics = (schema) => {
  // Get contact statistics
  schema.statics.getStats = async function() {
    const stats = await this.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgResponseTime: { 
            $avg: { 
              $subtract: [
                { $ifNull: ['$resolvedAt', '$updatedAt'] }, 
                '$createdAt'
              ] 
            } 
          }
        }
      }
    ]);
    
    const priorityStats = await this.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const categoryStats = await this.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const total = await this.countDocuments();
    const openTickets = await this.countDocuments({ 
      status: { $in: [CONTACT_STATUS.OPEN, CONTACT_STATUS.IN_PROGRESS] },
      isArchived: false 
    });
    
    const highPriority = await this.countDocuments({ 
      priority: { $in: [CONTACT_PRIORITY.HIGH, CONTACT_PRIORITY.URGENT] },
      status: { $in: [CONTACT_STATUS.OPEN, CONTACT_STATUS.IN_PROGRESS] },
      isArchived: false
    });
    
    const unread = await this.countDocuments({ 
      isRead: false, 
      isArchived: false 
    });
    
    const avgResponseTime = stats.length ? 
      Math.round(stats.reduce((acc, curr) => acc + (curr.avgResponseTime || 0), 0) / (1000 * 60 * 60)) : 0;
    
    return {
      byStatus: stats,
      byPriority: priorityStats,
      byCategory: categoryStats,
      total,
      openTickets,
      highPriority,
      unread,
      avgResponseTimeHours: avgResponseTime,
      archived: await this.countDocuments({ isArchived: true })
    };
  };
  
  // Get contacts by assignee
  schema.statics.getByAssignee = function(adminId) {
    return this.find({ assignedTo: adminId, isArchived: false })
      .populate('user', 'username displayName avatar email')
      .populate('assignedTo', 'username displayName')
      .sort({ priority: -1, createdAt: -1 });
  };
  
  // Get unassigned contacts
  schema.statics.getUnassigned = function() {
    return this.find({ 
      assignedTo: null, 
      isArchived: false,
      status: { $in: [CONTACT_STATUS.OPEN, CONTACT_STATUS.IN_PROGRESS] }
    })
      .populate('user', 'username displayName email')
      .sort({ priority: -1, createdAt: 1 });
  };
  
  // Get contacts by user
  schema.statics.getByUser = function(userId) {
    return this.find({ user: userId })
      .sort({ createdAt: -1 });
  };
  
  // Get contacts needing follow-up
  schema.statics.getNeedingFollowUp = function() {
    const now = new Date();
    return this.find({
      followUpDate: { $lte: now, $ne: null },
      status: { $nin: [CONTACT_STATUS.RESOLVED, CONTACT_STATUS.CLOSED] },
      isArchived: false
    })
      .populate('user', 'username displayName email phone')
      .populate('assignedTo', 'username displayName')
      .sort({ followUpDate: 1 });
  };
  
  // Search contacts
  schema.statics.search = function(query, filters = {}) {
    const searchQuery = {
      $and: [
        {
          $or: [
            { subject: { $regex: query, $options: 'i' } },
            { message: { $regex: query, $options: 'i' } },
            { requestID: { $regex: query, $options: 'i' } },
            { userEmail: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } }
          ]
        },
        { isArchived: filters.isArchived || false }
      ]
    };
    
    if (filters.status) {
      searchQuery.$and.push({ status: filters.status });
    }
    
    if (filters.priority) {
      searchQuery.$and.push({ priority: filters.priority });
    }
    
    if (filters.category) {
      searchQuery.$and.push({ category: filters.category });
    }
    
    if (filters.assignedTo) {
      searchQuery.$and.push({ assignedTo: filters.assignedTo });
    }
    
    return this.find(searchQuery)
      .populate('user', 'username displayName email')
      .populate('assignedTo', 'username displayName')
      .sort({ priority: -1, createdAt: -1 })
      .limit(filters.limit || 50);
  };
  
  // Get daily contact report
  schema.statics.getDailyReport = function(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byStatus: {
            $push: {
              status: '$status',
              count: 1
            }
          },
          byPriority: {
            $push: {
              priority: '$priority',
              count: 1
            }
          }
        }
      },
      {
        $project: {
          total: 1,
          byStatus: { $arrayToObject: { $map: {
            input: '$byStatus',
            as: 'item',
            in: { k: '$$item.status', v: '$$item.count' }
          }}},
          byPriority: { $arrayToObject: { $map: {
            input: '$byPriority',
            as: 'item',
            in: { k: '$$item.priority', v: '$$item.count' }
          }}}
        }
      }
    ]);
  };
  
  // Bulk update contacts
  schema.statics.bulkUpdate = async function(contactIds, updateData, userId) {
    return this.updateMany(
      { _id: { $in: contactIds } },
      {
        $set: {
          ...updateData,
          updatedBy: userId,
          updatedAt: new Date()
        }
      }
    );
  };
  
  // Archive old resolved contacts
  schema.statics.archiveOldResolved = async function(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    return this.updateMany(
      {
        status: { $in: [CONTACT_STATUS.RESOLVED, CONTACT_STATUS.CLOSED] },
        updatedAt: { $lt: cutoffDate },
        isArchived: false
      },
      {
        $set: {
          isArchived: true,
          updatedAt: new Date()
        }
      }
    );
  };
};