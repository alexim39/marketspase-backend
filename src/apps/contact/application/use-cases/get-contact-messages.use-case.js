import { GetContactMessagesDto } from "../dto/get-contact-messages.dto.js";

export class GetContactMessagesUseCase {
  constructor({ contactRepository, contactUserRepository }) {
    this.contactRepository = contactRepository;
    this.contactUserRepository = contactUserRepository;
  }

  async execute(input) {
    const dto = input instanceof GetContactMessagesDto
      ? input
      : new GetContactMessagesDto(input);

    const filter = this.buildFilter(dto);
    const pageNum = parseInt(dto.page);
    const limitNum = parseInt(dto.limit);
    const skip = (pageNum - 1) * limitNum;
    const sort = {
      [dto.sortBy]: dto.sortOrder === "desc" ? -1 : 1,
    };

    const [total, rawContacts, stats, openTickets, highPriority] =
      await Promise.all([
        this.contactRepository.countByFilter(filter),
        this.contactRepository.findMessages({ filter, sort, skip, limit: limitNum }),
        this.contactRepository.getStatusStats(filter),
        this.contactRepository.countOpenTickets(filter),
        this.contactRepository.countHighPriorityTickets(filter),
      ]);

    const contacts = await this.populateUserData(rawContacts);
    const validResponseTimes = stats
      .filter((stat) => stat.avgResponseTime !== null)
      .map((stat) => stat.avgResponseTime);

    const averageResponseTime =
      validResponseTimes.length > 0
        ? Math.round(
            validResponseTimes.reduce((totalTime, value) => totalTime + value, 0) /
              validResponseTimes.length,
          )
        : 0;

    return {
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
    };
  }

  buildFilter(dto) {
    const filter = {};

    if (dto.status && dto.status !== "all") {
      filter.status = dto.status;
    }

    if (dto.priority && dto.priority !== "all") {
      filter.priority = dto.priority;
    }

    if (dto.category && dto.category !== "all") {
      filter.category = dto.category;
    }

    if (dto.reason && dto.reason !== "all") {
      filter.reason = dto.reason;
    }

    if (dto.assignedTo && dto.assignedTo !== "all") {
      filter.assignedTo = dto.assignedTo === "unassigned" ? null : dto.assignedTo;
    }

    if (dto.isArchived !== undefined) {
      filter.isArchived = dto.isArchived === "true";
    }

    if (dto.dateFrom || dto.dateTo) {
      filter.createdAt = {};

      if (dto.dateFrom) {
        filter.createdAt.$gte = new Date(dto.dateFrom);
      }

      if (dto.dateTo) {
        const endOfDay = new Date(dto.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endOfDay;
      }
    }

    if (dto.search) {
      const searchRegex = new RegExp(dto.search, "i");
      filter.$or = [
        { subject: searchRegex },
        { message: searchRegex },
        { userEmail: searchRegex },
        { requestID: searchRegex },
      ];
    }

    return filter;
  }

  async populateUserData(contacts) {
    if (!contacts || contacts.length === 0) return contacts;

    const userIds = [
      ...new Set(contacts.map((contact) => contact.user.toString())),
    ];

    const users = await this.contactUserRepository.findContactUsersByIds(userIds);
    const userMap = users.reduce((map, user) => {
      map[user._id.toString()] = user;
      return map;
    }, {});

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
  }
}
