import { ContactModel } from "../models/index.js";
import { UserModel } from "../../user/models/user/index.js";
import { sendEmail } from "../../../core/email.service.js";
import mongoose from "mongoose";
import { AddContactAdminNoteDto } from "../application/dto/add-contact-admin-note.dto.js";
import { AddContactAdminNoteUseCase } from "../application/use-cases/add-contact-admin-note.use-case.js";
import { AssignContactToAdminDto } from "../application/dto/assign-contact-to-admin.dto.js";
import { AssignContactToAdminUseCase } from "../application/use-cases/assign-contact-to-admin.use-case.js";
import { BulkUpdateContactStatusDto } from "../application/dto/bulk-update-contact-status.dto.js";
import { BulkUpdateContactStatusUseCase } from "../application/use-cases/bulk-update-contact-status.use-case.js";
import { DeleteContactDto } from "../application/dto/delete-contact.dto.js";
import { DeleteContactUseCase } from "../application/use-cases/delete-contact.use-case.js";
import { ExportContactsDto } from "../application/dto/export-contacts.dto.js";
import { ExportContactsUseCase } from "../application/use-cases/export-contacts.use-case.js";
import { GetAvailableContactAdminsUseCase } from "../application/use-cases/get-available-contact-admins.use-case.js";
import { GetContactMessageDto } from "../application/dto/get-contact-message.dto.js";
import { GetContactMessageUseCase } from "../application/use-cases/get-contact-message.use-case.js";
import { GetContactMessagesDto } from "../application/dto/get-contact-messages.dto.js";
import { GetContactMessagesUseCase } from "../application/use-cases/get-contact-messages.use-case.js";
import { GetContactStatsUseCase } from "../application/use-cases/get-contact-stats.use-case.js";
import { MarkContactReadDto } from "../application/dto/mark-contact-read.dto.js";
import { MarkContactReadUseCase } from "../application/use-cases/mark-contact-read.use-case.js";
import { SetContactFollowUpDto } from "../application/dto/set-contact-follow-up.dto.js";
import { SetContactFollowUpUseCase } from "../application/use-cases/set-contact-follow-up.use-case.js";
import { SubmitContactDto } from "../application/dto/submit-contact.dto.js";
import { SubmitContactUseCase } from "../application/use-cases/submit-contact.use-case.js";
import { ToggleContactArchiveDto } from "../application/dto/toggle-contact-archive.dto.js";
import { ToggleContactArchiveUseCase } from "../application/use-cases/toggle-contact-archive.use-case.js";
import { UpdateContactPriorityDto } from "../application/dto/update-contact-priority.dto.js";
import { UpdateContactPriorityUseCase } from "../application/use-cases/update-contact-priority.use-case.js";
import { UpdateContactStatusDto } from "../application/dto/update-contact-status.dto.js";
import { UpdateContactStatusUseCase } from "../application/use-cases/update-contact-status.use-case.js";
import { UpdateContactTagsDto } from "../application/dto/update-contact-tags.dto.js";
import { UpdateContactTagsUseCase } from "../application/use-cases/update-contact-tags.use-case.js";
import {
  ContactAdminNoteRequiredError,
  ContactAuthenticationRequiredError,
  ContactInvalidAdminIdError,
  ContactInvalidAdminUserError,
  ContactInvalidArchiveValueError,
  ContactInvalidIdError,
  ContactInvalidPriorityValueError,
  ContactInvalidStatusValueError,
  ContactInvalidTagsValueError,
  ContactIdsRequiredError,
  ContactNoValidIdsError,
  ContactNotFoundError,
  ContactUserNotFoundError,
} from "../domain/errors/contact.errors.js";
import { MongooseContactRepository } from "../infrastructure/repositories/mongoose-contact.repository.js";
import { MongooseContactUserRepository } from "../infrastructure/repositories/mongoose-contact-user.repository.js";
import { ContactResponsePresenter } from "../presentation/presenters/contact-response.presenter.js";

const submitContactUseCase = new SubmitContactUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
});

const getContactMessagesUseCase = new GetContactMessagesUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
});

const getContactMessageUseCase = new GetContactMessageUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const getContactStatsUseCase = new GetContactStatsUseCase({
  contactRepository: new MongooseContactRepository(),
});

const getAvailableContactAdminsUseCase = new GetAvailableContactAdminsUseCase({
  contactUserRepository: new MongooseContactUserRepository(),
});

const markContactReadUseCase = new MarkContactReadUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const toggleContactArchiveUseCase = new ToggleContactArchiveUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const setContactFollowUpUseCase = new SetContactFollowUpUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const updateContactPriorityUseCase = new UpdateContactPriorityUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const updateContactStatusUseCase = new UpdateContactStatusUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const assignContactToAdminUseCase = new AssignContactToAdminUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
  isValidAdminId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const addContactAdminNoteUseCase = new AddContactAdminNoteUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const updateContactTagsUseCase = new UpdateContactTagsUseCase({
  contactRepository: new MongooseContactRepository(),
  contactUserRepository: new MongooseContactUserRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const deleteContactUseCase = new DeleteContactUseCase({
  contactRepository: new MongooseContactRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const bulkUpdateContactStatusUseCase = new BulkUpdateContactStatusUseCase({
  contactRepository: new MongooseContactRepository(),
  isValidContactId: (id) => mongoose.Types.ObjectId.isValid(id),
});

const exportContactsUseCase = new ExportContactsUseCase({
  contactRepository: new MongooseContactRepository(),
});

//generate a numerical id.
function generateNumericContactRequestId(length = 8) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10); // Generates a random digit (0-9)
  }
  return result;
}

const legacyContactController = async (req, res) => {
  const requestID = generateNumericContactRequestId();
  try {
    const userId = req.userId;
    const { reason, subject, message, userEmail } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required.",
        success: false,
      });
    }

    //console.log("Received contact request from userId:", req.body);

    // Find the user by their ID
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
        success: false,
      });
    }

    await UserModel.updateOne(
      { _id: user._id },
      { $set: { lastSeenAt: new Date() } }
    );

    const contactObject = await ContactModel.create({
      user: user._id, // Use the user's ObjectId
      reason,
      subject,
      message,
      requestID: requestID,
      userEmail: user.email || userEmail,
    });
    // Send email to form owner
    //         const ownerSubject = 'MarketSpase Contact Request';
    //         const ownerMessage = ownerContactEmailTemplate(contactObject);
    //         const ownerEmails = ['ago.fnc@gmail.com'];
    //         await Promise.all(ownerEmails.map(email => sendEmail(email, ownerSubject, ownerMessage)));

    //         // Send email to the user
    //         const userSubject = `MarketSpase Contact Request - ${requestID}`;
    //         const userMessage = userContactEmailTemplate(contactObject);
    //         const receiverEmails = [user.email]; // Use the user's email from the database
    //         await Promise.all(receiverEmails.map(email => sendEmail(email, userSubject, userMessage)));

    res
      .status(200)
      .json({
        data: contactObject,
        success: true,
        message: "Request submitted successfully, you will hear from us soon",
      });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      message: "internal server error",
      success: false,
    });
  }
};

// User contact controller
export const ContactController = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyContactController(req, res);
  }

  try {
    const result = await submitContactUseCase.execute(
      SubmitContactDto.fromRequest({
        userId: req.userId,
        body: req.body,
      }),
    );

    return res.status(200).json(ContactResponsePresenter.submitted(result));
  } catch (error) {
    if (error instanceof ContactAuthenticationRequiredError) {
      return res
        .status(401)
        .json(ContactResponsePresenter.authenticationRequired());
    }

    if (error instanceof ContactUserNotFoundError) {
      return res.status(404).json(ContactResponsePresenter.userNotFound());
    }

    console.error(error.message);
    return res.status(500).json(ContactResponsePresenter.internalServerError());
  }
};

// Helper function to populate user data
const populateUserData = async (contacts) => {
  if (!contacts || contacts.length === 0) return contacts;

  // Get all user IDs from contacts
  const userIds = [
    ...new Set(contacts.map((contact) => contact.user.toString())),
  ];

  // Fetch users in a single query
  const users = await UserModel.find({ _id: { $in: userIds } })
    .select("username displayName avatar email")
    .lean();

  // Create a map for quick lookup
  const userMap = users.reduce((map, user) => {
    map[user._id.toString()] = user;
    return map;
  }, {});

  // Populate user data
  return contacts.map((contact) => ({
    ...(contact.toObject ? contact.toObject() : contact),
    user: userMap[contact.user.toString()] || {
      _id: contact.user,
      username: "Unknown",
      displayName: "Unknown User",
      avatar: "/img/avatar.png",
      email: contact.userEmail,
    },
  }));
};

// Get all contact messages with filters and pagination
const legacyGetContactMessages = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      category,
      reason,
      assignedTo,
      search,
      dateFrom,
      dateTo,
      isArchived,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status && status !== "all") {
      filter.status = status;
    }

    // Priority filter
    if (priority && priority !== "all") {
      filter.priority = priority;
    }

    // Category filter
    if (category && category !== "all") {
      filter.category = category;
    }

    // Reason filter
    if (reason && reason !== "all") {
      filter.reason = reason;
    }

    // Assigned to filter
    if (assignedTo && assignedTo !== "all") {
      if (assignedTo === "unassigned") {
        filter.assignedTo = null;
      } else {
        filter.assignedTo = assignedTo;
      }
    }

    // Archive filter
    if (isArchived !== undefined) {
      filter.isArchived = isArchived === "true";
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endOfDay;
      }
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { subject: searchRegex },
        { message: searchRegex },
        { userEmail: searchRegex },
        { requestID: searchRegex },
      ];
    }

    // Parse pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get total count for pagination
    const total = await ContactModel.countDocuments(filter);

    // Fetch contacts with pagination
    let contacts = await ContactModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate("assignedTo", "username displayName")
      .lean();

    // Populate user data
    contacts = await populateUserData(contacts);

    // Get statistics for the current filter
    const stats = await ContactModel.aggregate([
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

    const openTickets = await ContactModel.countDocuments({
      ...filter,
      status: "open",
    });

    const highPriority = await ContactModel.countDocuments({
      ...filter,
      priority: { $in: ["high", "urgent"] },
      status: { $in: ["open", "in_progress"] },
    });

    // Calculate average response time
    const validResponseTimes = stats
      .filter((stat) => stat.avgResponseTime !== null)
      .map((stat) => stat.avgResponseTime);

    const averageResponseTime =
      validResponseTimes.length > 0
        ? Math.round(
            validResponseTimes.reduce((a, b) => a + b, 0) /
              validResponseTimes.length,
          )
        : 0;

    res.status(200).json({
      success: true,
      data: contacts,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      stats: {
        byStatus: stats,
        total,
        openTickets,
        highPriority,
        averageResponseTime,
      },
    });
  } catch (error) {
    console.error("Error fetching contact messages:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact messages",
      error: error.message,
    });
  }
};

export const getContactMessages = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyGetContactMessages(req, res);
  }

  try {
    const result = await getContactMessagesUseCase.execute(
      GetContactMessagesDto.fromRequest({ query: req.query }),
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching contact messages:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contact messages",
      error: error.message,
    });
  }
};

// Get single contact message by ID
const legacyGetContactMessage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    const contact = await ContactModel.findById(id)
      .populate("assignedTo", "username displayName avatar")
      .populate("adminNotes.admin", "username displayName");

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    // Populate user data
    const populatedContact = await populateUserData([contact]);

    res.status(200).json({
      success: true,
      data: populatedContact[0],
    });
  } catch (error) {
    console.error("Error fetching contact message:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact message",
      error: error.message,
    });
  }
};

export const getContactMessage = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyGetContactMessage(req, res);
  }

  try {
    const result = await getContactMessageUseCase.execute(
      GetContactMessageDto.fromRequest({ params: req.params }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactInvalidIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (error instanceof ContactNotFoundError) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    console.error("Error fetching contact message:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contact message",
      error: error.message,
    });
  }
};

// Update contact status
const legacyUpdateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    const validStatuses = ["open", "in_progress", "resolved", "closed", "spam"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const contact = await ContactModel.findById(id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    // If resolving or closing, add resolution notes
    const updateData = { status };
    if ((status === "resolved" || status === "closed") && notes) {
      updateData.resolutionNotes = notes;
      updateData.resolvedAt = new Date();
    }

    // If reopening, clear resolution data
    if (status === "open" || status === "in_progress") {
      updateData.resolvedAt = null;
      if (!notes) {
        updateData.resolutionNotes = "";
      }
    }

    const updatedContact = await ContactModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");

    // Add admin note if provided
    if (notes) {
      await updatedContact.addAdminNote(
        req.user._id,
        `Status changed to ${status}: ${notes}`,
      );
    }

    // Populate user data
    const populatedContact = await populateUserData([updatedContact]);

    res.status(200).json({
      success: true,
      data: populatedContact[0],
      message: `Contact status updated to ${status}`,
    });
  } catch (error) {
    console.error("Error updating contact status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update contact status",
      error: error.message,
    });
  }
};

export const updateContactStatus = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyUpdateContactStatus(req, res);
  }

  try {
    const result = await updateContactStatusUseCase.execute(
      UpdateContactStatusDto.fromRequest({
        params: req.params,
        body: req.body,
        user: req.user,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactInvalidIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (error instanceof ContactInvalidStatusValueError) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    if (error instanceof ContactNotFoundError) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    console.error("Error updating contact status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update contact status",
      error: error.message,
    });
  }
};

// Update contact priority
const legacyUpdateContactPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority value",
      });
    }

    const contact = await ContactModel.findByIdAndUpdate(
      id,
      { priority },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    // Add admin note about priority change
    await contact.addAdminNote(req.user._id, `Priority changed to ${priority}`);

    // Populate user data
    const populatedContact = await populateUserData([contact]);

    res.status(200).json({
      success: true,
      data: populatedContact[0],
      message: `Contact priority updated to ${priority}`,
    });
  } catch (error) {
    console.error("Error updating contact priority:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update contact priority",
      error: error.message,
    });
  }
};

export const updateContactPriority = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyUpdateContactPriority(req, res);
  }

  try {
    const result = await updateContactPriorityUseCase.execute(
      UpdateContactPriorityDto.fromRequest({
        params: req.params,
        body: req.body,
        user: req.user,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactInvalidIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (error instanceof ContactInvalidPriorityValueError) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority value",
      });
    }

    if (error instanceof ContactNotFoundError) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    console.error("Error updating contact priority:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update contact priority",
      error: error.message,
    });
  }
};

// Assign contact to admin
const legacyAssignContactToAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    // If adminId is empty string or null, unassign
    let admin = null;
    let noteMessage = "Unassigned from admin";

    if (adminId) {
      if (!mongoose.Types.ObjectId.isValid(adminId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid admin ID",
        });
      }

      admin = await UserModel.findById(adminId);
      if (!admin || !["admin", "marketing_rep"].includes(admin.role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid admin user",
        });
      }

      noteMessage = `Assigned to ${admin.displayName}`;
    }

    const contact = await ContactModel.findByIdAndUpdate(
      id,
      { assignedTo: adminId || null },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    // Add admin note about assignment
    await contact.addAdminNote(req.user._id, noteMessage);

    // Populate user data
    const populatedContact = await populateUserData([contact]);

    res.status(200).json({
      success: true,
      data: populatedContact[0],
      message: adminId ? "Contact assigned successfully" : "Contact unassigned",
    });
  } catch (error) {
    console.error("Error assigning contact:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign contact",
      error: error.message,
    });
  }
};

export const assignContactToAdmin = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyAssignContactToAdmin(req, res);
  }

  try {
    const result = await assignContactToAdminUseCase.execute(
      AssignContactToAdminDto.fromRequest({
        params: req.params,
        body: req.body,
        user: req.user,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactInvalidIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (error instanceof ContactInvalidAdminIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID",
      });
    }

    if (error instanceof ContactInvalidAdminUserError) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin user",
      });
    }

    if (error instanceof ContactNotFoundError) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    console.error("Error assigning contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign contact",
      error: error.message,
    });
  }
};

// Add admin note
const legacyAddAdminNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (!note || note.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Note is required",
      });
    }

    const contact = await ContactModel.findById(id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    // Add the note
    await contact.addAdminNote(req.user._id, note.trim());

    // Refresh contact with populated data
    const updatedContact = await ContactModel.findById(id)
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");

    // Populate user data
    const populatedContact = await populateUserData([updatedContact]);

    res.status(200).json({
      success: true,
      data: populatedContact[0],
      message: "Note added successfully",
    });
  } catch (error) {
    console.error("Error adding admin note:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add note",
      error: error.message,
    });
  }
};

export const addAdminNote = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyAddAdminNote(req, res);
  }

  try {
    const result = await addContactAdminNoteUseCase.execute(
      AddContactAdminNoteDto.fromRequest({
        params: req.params,
        body: req.body,
        user: req.user,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactInvalidIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (error instanceof ContactAdminNoteRequiredError) {
      return res.status(400).json({
        success: false,
        message: "Note is required",
      });
    }

    if (error instanceof ContactNotFoundError) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    console.error("Error adding admin note:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add note",
      error: error.message,
    });
  }
};

// Update tags
const legacyUpdateTags = async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    // Validate tags array
    if (!Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: "Tags must be an array",
      });
    }

    // Trim and filter empty tags
    const cleanedTags = tags
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");

    const contact = await ContactModel.findByIdAndUpdate(
      id,
      { tags: cleanedTags },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    // Add admin note about tag update
    await contact.addAdminNote(
      req.user._id,
      `Tags updated: ${cleanedTags.join(", ") || "No tags"}`,
    );

    // Populate user data
    const populatedContact = await populateUserData([contact]);

    res.status(200).json({
      success: true,
      data: populatedContact[0],
      message: "Tags updated successfully",
    });
  } catch (error) {
    console.error("Error updating tags:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update tags",
      error: error.message,
    });
  }
};

export const updateTags = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyUpdateTags(req, res);
  }

  try {
    const result = await updateContactTagsUseCase.execute(
      UpdateContactTagsDto.fromRequest({
        params: req.params,
        body: req.body,
        user: req.user,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactInvalidIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (error instanceof ContactInvalidTagsValueError) {
      return res.status(400).json({
        success: false,
        message: "Tags must be an array",
      });
    }

    if (error instanceof ContactNotFoundError) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    console.error("Error updating tags:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update tags",
      error: error.message,
    });
  }
};

// Mark as read
const legacyMarkAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    const contact = await ContactModel.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    // Populate user data
    const populatedContact = await populateUserData([contact]);

    res.status(200).json({
      success: true,
      data: populatedContact[0],
      message: "Contact marked as read",
    });
  } catch (error) {
    console.error("Error marking contact as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark contact as read",
      error: error.message,
    });
  }
};

export const markAsRead = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyMarkAsRead(req, res);
  }

  try {
    const result = await markContactReadUseCase.execute(
      MarkContactReadDto.fromRequest({ params: req.params }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactInvalidIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (error instanceof ContactNotFoundError) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    console.error("Error marking contact as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark contact as read",
      error: error.message,
    });
  }
};

// Archive/unarchive contact
const legacyToggleArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const { archived } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (typeof archived !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Archived must be a boolean value",
      });
    }

    const contact = await ContactModel.findByIdAndUpdate(
      id,
      { isArchived: archived },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    // Add admin note about archive status
    const action = archived ? "archived" : "unarchived";
    await contact.addAdminNote(req.user._id, `Contact ${action}`);

    // Populate user data
    const populatedContact = await populateUserData([contact]);

    res.status(200).json({
      success: true,
      data: populatedContact[0],
      message: `Contact ${action} successfully`,
    });
  } catch (error) {
    console.error("Error toggling archive status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update archive status",
      error: error.message,
    });
  }
};

export const toggleArchive = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyToggleArchive(req, res);
  }

  try {
    const result = await toggleContactArchiveUseCase.execute(
      ToggleContactArchiveDto.fromRequest({
        params: req.params,
        body: req.body,
        user: req.user,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactInvalidIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (error instanceof ContactInvalidArchiveValueError) {
      return res.status(400).json({
        success: false,
        message: "Archived must be a boolean value",
      });
    }

    if (error instanceof ContactNotFoundError) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    console.error("Error toggling archive status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update archive status",
      error: error.message,
    });
  }
};

// Set follow-up date
const legacySetFollowUpDate = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    const followUpDate = date ? new Date(date) : null;

    const contact = await ContactModel.findByIdAndUpdate(
      id,
      { followUpDate },
      { new: true, runValidators: true },
    )
      .populate("assignedTo", "username displayName")
      .populate("adminNotes.admin", "username displayName");

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    // Add admin note about follow-up date
    const noteMessage = followUpDate
      ? `Follow-up date set to ${followUpDate.toLocaleDateString()}`
      : "Follow-up date cleared";
    await contact.addAdminNote(req.user._id, noteMessage);

    // Populate user data
    const populatedContact = await populateUserData([contact]);

    res.status(200).json({
      success: true,
      data: populatedContact[0],
      message: noteMessage,
    });
  } catch (error) {
    console.error("Error setting follow-up date:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set follow-up date",
      error: error.message,
    });
  }
};

export const setFollowUpDate = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacySetFollowUpDate(req, res);
  }

  try {
    const result = await setContactFollowUpUseCase.execute(
      SetContactFollowUpDto.fromRequest({
        params: req.params,
        body: req.body,
        user: req.user,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactInvalidIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (error instanceof ContactNotFoundError) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    console.error("Error setting follow-up date:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to set follow-up date",
      error: error.message,
    });
  }
};

// Delete contact
const legacyDeleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    const contact = await ContactModel.findByIdAndDelete(id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete contact",
      error: error.message,
    });
  }
};

export const deleteContact = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyDeleteContact(req, res);
  }

  try {
    const result = await deleteContactUseCase.execute(
      DeleteContactDto.fromRequest({ params: req.params }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactInvalidIdError) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      });
    }

    if (error instanceof ContactNotFoundError) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    console.error("Error deleting contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete contact",
      error: error.message,
    });
  }
};

// Bulk operations
const legacyBulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No contact IDs provided",
      });
    }

    const validStatuses = ["open", "in_progress", "resolved", "closed", "spam"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    // Validate all IDs
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid contact IDs provided",
      });
    }

    // Prepare update data
    const updateData = { status };
    if (status === "resolved" || status === "closed") {
      updateData.resolvedAt = new Date();
    } else {
      updateData.resolvedAt = null;
    }

    // Bulk update
    const result = await ContactModel.updateMany(
      { _id: { $in: validIds } },
      updateData,
    );

    // Add admin notes for each updated contact
    for (const id of validIds) {
      const contact = await ContactModel.findById(id);
      if (contact) {
        await contact.addAdminNote(
          req.user._id,
          `Bulk status update: Changed to ${status}`,
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} contacts`,
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error in bulk status update:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update contacts",
      error: error.message,
    });
  }
};

export const bulkUpdateStatus = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyBulkUpdateStatus(req, res);
  }

  try {
    const result = await bulkUpdateContactStatusUseCase.execute(
      BulkUpdateContactStatusDto.fromRequest({
        body: req.body,
        user: req.user,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ContactIdsRequiredError) {
      return res.status(400).json({
        success: false,
        message: "No contact IDs provided",
      });
    }

    if (error instanceof ContactInvalidStatusValueError) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    if (error instanceof ContactNoValidIdsError) {
      return res.status(400).json({
        success: false,
        message: "No valid contact IDs provided",
      });
    }

    console.error("Error in bulk status update:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update contacts",
      error: error.message,
    });
  }
};

// Export contacts
const legacyExportContacts = async (req, res) => {
  try {
    const { format = "csv", ...filters } = req.query;

    // Build filter object (similar to getContactMessages)
    const filter = {};

    if (filters.status && filters.status !== "all") {
      filter.status = filters.status;
    }
    if (filters.priority && filters.priority !== "all") {
      filter.priority = filters.priority;
    }
    if (filters.category && filters.category !== "all") {
      filter.category = filters.category;
    }
    if (filters.reason && filters.reason !== "all") {
      filter.reason = filters.reason;
    }
    if (filters.assignedTo && filters.assignedTo !== "all") {
      filter.assignedTo =
        filters.assignedTo === "unassigned" ? null : filters.assignedTo;
    }
    if (filters.isArchived !== undefined) {
      filter.isArchived = filters.isArchived === "true";
    }

    // Fetch all contacts matching filters
    const contacts = await ContactModel.find(filter)
      .populate("user", "username displayName email")
      .populate("assignedTo", "username displayName")
      .sort({ createdAt: -1 })
      .lean();

    // Format data based on export format
    let exportData;
    let contentType;
    let fileName;

    switch (format) {
      case "json":
        exportData = JSON.stringify(contacts, null, 2);
        contentType = "application/json";
        fileName = `contacts_export_${new Date().toISOString().split("T")[0]}.json`;
        break;

      case "csv":
      default:
        // Convert to CSV
        const headers = [
          "Request ID",
          "User",
          "Email",
          "Subject",
          "Message",
          "Status",
          "Priority",
          "Category",
          "Reason",
          "Created At",
          "Resolved At",
          "Assigned To",
          "Tags",
        ];

        const rows = contacts.map((contact) => [
          contact.requestID,
          contact.user?.displayName || "Unknown",
          contact.userEmail,
          `"${contact.subject.replace(/"/g, '""')}"`,
          `"${contact.message.replace(/"/g, '""').replace(/\n/g, " ")}"`,
          contact.status,
          contact.priority,
          contact.category,
          contact.reason,
          contact.createdAt.toISOString(),
          contact.resolvedAt ? contact.resolvedAt.toISOString() : "",
          contact.assignedTo?.displayName || "",
          contact.tags.join(", "),
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((row) => row.join(",")),
        ].join("\n");

        exportData = csvContent;
        contentType = "text/csv";
        fileName = `contacts_export_${new Date().toISOString().split("T")[0]}.csv`;
        break;
    }

    // Set headers and send file
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(exportData);
  } catch (error) {
    console.error("Error exporting contacts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export contacts",
      error: error.message,
    });
  }
};

export const exportContacts = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyExportContacts(req, res);
  }

  try {
    const result = await exportContactsUseCase.execute(
      ExportContactsDto.fromRequest({ query: req.query }),
    );

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    return res.send(result.body);
  } catch (error) {
    console.error("Error exporting contacts:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export contacts",
      error: error.message,
    });
  }
};

// Get contact statistics
const legacyGetContactStats = async (req, res) => {
  try {
    const stats = await ContactModel.getStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting contact stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get contact statistics",
      error: error.message,
    });
  }
};

export const getContactStats = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyGetContactStats(req, res);
  }

  try {
    const result = await getContactStatsUseCase.execute();

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error getting contact stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get contact statistics",
      error: error.message,
    });
  }
};

// Get available admins for assignment
const legacyGetAvailableAdmins = async (req, res) => {
  try {
    const admins = await UserModel.find({
      role: { $in: ["admin", "marketing_rep"] },
      isActive: true,
      isDeleted: false,
    })
      .select("username displayName avatar")
      .sort({ displayName: 1 });

    res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admins",
      error: error.message,
    });
  }
};

export const getAvailableAdmins = async (req, res) => {
  if (process.env.CONTACT_DDD_ENABLED === "false") {
    return legacyGetAvailableAdmins(req, res);
  }

  try {
    const result = await getAvailableContactAdminsUseCase.execute();

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching admins:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admins",
      error: error.message,
    });
  }
};
