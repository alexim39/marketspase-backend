import test from "node:test";
import assert from "node:assert/strict";

import { GetContactMessagesDto } from "../application/dto/get-contact-messages.dto.js";
import { GetContactMessagesUseCase } from "../application/use-cases/get-contact-messages.use-case.js";

test("GetContactMessagesUseCase returns the same list response shape with populated users", async () => {
  const repositoryCalls = [];

  const useCase = new GetContactMessagesUseCase({
    contactRepository: {
      async countByFilter(filter) {
        repositoryCalls.push({ method: "countByFilter", filter });
        return 2;
      },
      async findMessages({ filter, sort, skip, limit }) {
        repositoryCalls.push({ method: "findMessages", filter, sort, skip, limit });
        return [
          {
            _id: "contact-1",
            user: "user-1",
            userEmail: "ada@example.com",
            subject: "First",
          },
          {
            _id: "contact-2",
            user: "missing-user",
            userEmail: "missing@example.com",
            subject: "Second",
          },
        ];
      },
      async getStatusStats(filter) {
        repositoryCalls.push({ method: "getStatusStats", filter });
        return [
          { _id: "resolved", count: 1, avgResponseTime: 2000 },
          { _id: "open", count: 1, avgResponseTime: null },
        ];
      },
      async countOpenTickets(filter) {
        repositoryCalls.push({ method: "countOpenTickets", filter });
        return 1;
      },
      async countHighPriorityTickets(filter) {
        repositoryCalls.push({ method: "countHighPriorityTickets", filter });
        return 1;
      },
    },
    contactUserRepository: {
      async findContactUsersByIds(userIds) {
        assert.deepEqual(userIds, ["user-1", "missing-user"]);
        return [
          {
            _id: "user-1",
            username: "adalovelace",
            displayName: "Ada Lovelace",
            avatar: "/ada.png",
            email: "ada@example.com",
          },
        ];
      },
    },
  });

  const result = await useCase.execute({
    page: "2",
    limit: "20",
    status: "open",
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  assert.equal(result.success, true);
  assert.equal(result.total, 2);
  assert.equal(result.page, 2);
  assert.equal(result.limit, 20);
  assert.equal(result.pages, 1);
  assert.equal(result.stats.averageResponseTime, 2000);
  assert.equal(result.stats.openTickets, 1);
  assert.equal(result.stats.highPriority, 1);
  assert.equal(result.data[0].user.displayName, "Ada Lovelace");
  assert.deepEqual(result.data[1].user, {
    _id: "missing-user",
    username: "Unknown",
    displayName: "Unknown User",
    avatar: "/img/avatar.png",
    email: "missing@example.com",
  });

  const findCall = repositoryCalls.find((call) => call.method === "findMessages");
  assert.deepEqual(findCall.filter, { status: "open" });
  assert.deepEqual(findCall.sort, { createdAt: -1 });
  assert.equal(findCall.skip, 20);
  assert.equal(findCall.limit, 20);
});

test("GetContactMessagesUseCase builds legacy-compatible admin filters", () => {
  const useCase = new GetContactMessagesUseCase({
    contactRepository: {},
    contactUserRepository: {},
  });

  const filter = useCase.buildFilter(
    new GetContactMessagesDto({
      status: "open",
      priority: "urgent",
      category: "support",
      reason: "technical",
      assignedTo: "unassigned",
      isArchived: "false",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-20",
      search: "billing",
    }),
  );

  assert.equal(filter.status, "open");
  assert.equal(filter.priority, "urgent");
  assert.equal(filter.category, "support");
  assert.equal(filter.reason, "technical");
  assert.equal(filter.assignedTo, null);
  assert.equal(filter.isArchived, false);
  assert.equal(filter.createdAt.$gte.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(filter.createdAt.$lte.getHours(), 23);
  assert.equal(filter.createdAt.$lte.getMinutes(), 59);
  assert.equal(filter.createdAt.$lte.getSeconds(), 59);
  assert.equal(filter.createdAt.$lte.getMilliseconds(), 999);
  assert.equal(filter.$or.length, 4);
  assert.equal(filter.$or[0].subject.source, "billing");
  assert.equal(filter.$or[0].subject.flags, "i");
});

test("GetContactMessagesUseCase ignores all-valued filters like the legacy controller", () => {
  const useCase = new GetContactMessagesUseCase({
    contactRepository: {},
    contactUserRepository: {},
  });

  const filter = useCase.buildFilter(
    new GetContactMessagesDto({
      status: "all",
      priority: "all",
      category: "all",
      reason: "all",
      assignedTo: "all",
    }),
  );

  assert.deepEqual(filter, {});
});
