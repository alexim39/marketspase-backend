import { ContactModel } from "../../models/index.js";

export class MongooseContactRepository {
  async create(contactData) {
    return ContactModel.create(contactData);
  }

  async countByFilter(filter) {
    return ContactModel.countDocuments(filter);
  }

  async findMessages({ filter, sort, skip, limit }) {
    return ContactModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("assignedTo", "username displayName")
      .lean();
  }

  async findExportContacts({ filter }) {
    return ContactModel.find(filter)
      .populate("user", "username displayName email")
      .populate("assignedTo", "username displayName")
      .sort({ createdAt: -1 })
      .lean();
  }

  async findByIdWithAdminDetails(contactId) {
    return ContactModel.findById(contactId)
      .populate("assignedTo", "username displayName avatar")
      .populate("adminNotes.admin", "username displayName");
  }

  async findByIdWithWorkflowDetails(contactId) {
    return ContactModel.findById(contactId)
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");
  }

  async findById(contactId) {
    return ContactModel.findById(contactId);
  }

  async markAsReadById(contactId) {
    return ContactModel.findByIdAndUpdate(
      contactId,
      { isRead: true },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");
  }

  async setArchiveStatusById({ contactId, archived }) {
    return ContactModel.findByIdAndUpdate(
      contactId,
      { isArchived: archived },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");
  }

  async setFollowUpDateById({ contactId, followUpDate }) {
    return ContactModel.findByIdAndUpdate(
      contactId,
      { followUpDate },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");
  }

  async setPriorityById({ contactId, priority }) {
    return ContactModel.findByIdAndUpdate(
      contactId,
      { priority },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");
  }

  async setStatusById({ contactId, updateData }) {
    return ContactModel.findByIdAndUpdate(
      contactId,
      updateData,
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");
  }

  async bulkSetStatusByIds({ contactIds, updateData }) {
    return ContactModel.updateMany(
      { _id: { $in: contactIds } },
      updateData,
    );
  }

  async assignToAdminById({ contactId, assigneeId }) {
    return ContactModel.findByIdAndUpdate(
      contactId,
      { assignedTo: assigneeId || null },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");
  }

  async setTagsById({ contactId, tags }) {
    return ContactModel.findByIdAndUpdate(
      contactId,
      { tags },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");
  }

  async deleteById(contactId) {
    return ContactModel.findByIdAndDelete(contactId);
  }

  async addAdminNote(contact, adminId, note) {
    return contact.addAdminNote(adminId, note);
  }

  async getStats() {
    return ContactModel.getStats();
  }

  async getStatusStats(filter) {
    return ContactModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgResponseTime: {
            $avg: {
              $cond: [
                { $ne: ["$resolvedAt", null] },
                { $subtract: ["$resolvedAt", "$createdAt"] },
                null,
              ],
            },
          },
        },
      },
    ]);
  }

  async countOpenTickets(filter) {
    return ContactModel.countDocuments({
      ...filter,
      status: "open",
    });
  }

  async countHighPriorityTickets(filter) {
    return ContactModel.countDocuments({
      ...filter,
      priority: { $in: ["high", "urgent"] },
      status: { $in: ["open", "in_progress"] },
    });
  }
}
