import test from "node:test";
import assert from "node:assert/strict";

import { GetNewslettersUseCase } from "../application/use-cases/get-newsletters.use-case.js";

test("GetNewslettersUseCase returns the legacy newsletter list response shape", async () => {
  const calls = [];
  const newsletters = [
    {
      _id: "newsletter-1",
      title: "Weekly Update",
      status: "draft",
    },
  ];

  const useCase = new GetNewslettersUseCase({
    newsletterRepository: {
      async findNewsletters({ filter, sort, skip, limit }) {
        calls.push({ method: "findNewsletters", filter, sort, skip, limit });
        return newsletters;
      },
      async countByFilter(filter) {
        calls.push({ method: "countByFilter", filter });
        return 21;
      },
    },
  });

  const result = await useCase.execute({
    status: "draft",
    search: "weekly",
    page: "2",
    limit: "10",
  });

  assert.deepEqual(result, {
    success: true,
    data: newsletters,
    pagination: {
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    },
    message: "Newsletters retrieved successfully",
  });

  assert.deepEqual(calls, [
    {
      method: "findNewsletters",
      filter: {
        isDeleted: false,
        status: "draft",
        $or: [
          { subject: { $regex: "weekly", $options: "i" } },
          { previewText: { $regex: "weekly", $options: "i" } },
          { title: { $regex: "weekly", $options: "i" } },
        ],
      },
      sort: { createdAt: -1 },
      skip: 10,
      limit: 10,
    },
    {
      method: "countByFilter",
      filter: {
        isDeleted: false,
        status: "draft",
        $or: [
          { subject: { $regex: "weekly", $options: "i" } },
          { previewText: { $regex: "weekly", $options: "i" } },
          { title: { $regex: "weekly", $options: "i" } },
        ],
      },
    },
  ]);
});

test("GetNewslettersUseCase keeps all status out of the filter", () => {
  const useCase = new GetNewslettersUseCase({
    newsletterRepository: {},
  });

  assert.deepEqual(
    useCase.buildFilter({
      status: "all",
      search: "",
    }),
    {
      isDeleted: false,
    },
  );
});

test("GetNewslettersUseCase defaults page and limit like the legacy service", async () => {
  let findArgs = null;
  const useCase = new GetNewslettersUseCase({
    newsletterRepository: {
      async findNewsletters(args) {
        findArgs = args;
        return [];
      },
      async countByFilter() {
        return 0;
      },
    },
  });

  const result = await useCase.execute({});

  assert.equal(findArgs.skip, 0);
  assert.equal(findArgs.limit, 10);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.limit, 10);
  assert.equal(result.pagination.totalPages, 0);
});
