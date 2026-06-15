import mongoose from "mongoose";
import { CustomerGroupModel } from "../models/index.js";
import { listCustomers } from "./customer.service.js";

/* ────── List groups ────── */

export const listGroups = async ({ marketerId }) => {
  if (!mongoose.Types.ObjectId.isValid(marketerId)) {
    const err = new Error("Invalid marketer ID");
    err.status = 400;
    throw err;
  }

  const groups = await CustomerGroupModel.find({ marketer: marketerId })
    .sort({ createdAt: -1 })
    .lean();

  return { groups };
};

/* ────── Create group ────── */

export const createGroup = async ({ marketerId, data }) => {
  if (!mongoose.Types.ObjectId.isValid(marketerId)) {
    const err = new Error("Invalid marketer ID");
    err.status = 400;
    throw err;
  }

  const { name, description = "", color = "#8b5cf6" } = data;

  if (!name || !name.trim()) {
    const err = new Error("Group name is required");
    err.status = 400;
    throw err;
  }

  const existing = await CustomerGroupModel.findOne({ marketer: marketerId, name: name.trim() }).lean();
  if (existing) {
    const err = new Error("A group with this name already exists");
    err.status = 409;
    throw err;
  }

  const group = await CustomerGroupModel.create({
    marketer: marketerId,
    name: name.trim(),
    description: description.trim(),
    color,
  });

  return group.toObject();
};

/* ────── Update group ────── */

export const updateGroup = async ({ groupId, marketerId, data }) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    const err = new Error("Invalid group ID");
    err.status = 400;
    throw err;
  }

  const group = await CustomerGroupModel.findOne({ _id: groupId, marketer: marketerId });
  if (!group) {
    const err = new Error("Group not found");
    err.status = 404;
    throw err;
  }

  const updates = {};
  const allowedFields = ["name", "description", "color"];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates[field] = field === "name" ? data[field].trim() : data[field];
    }
  }

  if (Object.keys(updates).length > 0) {
    await CustomerGroupModel.updateOne({ _id: groupId }, { $set: updates });
  }

  return CustomerGroupModel.findById(groupId).lean();
};

/* ────── Delete group ────── */

export const deleteGroup = async ({ groupId, marketerId }) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    const err = new Error("Invalid group ID");
    err.status = 400;
    throw err;
  }

  const group = await CustomerGroupModel.findOne({ _id: groupId, marketer: marketerId });
  if (!group) {
    const err = new Error("Group not found");
    err.status = 404;
    throw err;
  }

  // Remove group reference from all customers
  await mongoose.model("Customer").updateMany(
    { groups: groupId },
    { $pull: { groups: groupId } }
  );

  await CustomerGroupModel.deleteOne({ _id: groupId });

  return { deleted: true, removedFromMembers: true };
};

/* ────── Add members to group ────── */

export const addGroupMembers = async ({ groupId, marketerId, customerIds }) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    const err = new Error("Invalid group ID");
    err.status = 400;
    throw err;
  }

  const group = await CustomerGroupModel.findOne({ _id: groupId, marketer: marketerId });
  if (!group) {
    const err = new Error("Group not found");
    err.status = 404;
    throw err;
  }

  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    const err = new Error("No customer IDs provided");
    err.status = 400;
    throw err;
  }

  const validIds = customerIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const result = await mongoose.model("Customer").updateMany(
    { _id: { $in: validIds }, marketer: marketerId },
    { $addToSet: { groups: groupId } }
  );

  // Update member count
  const count = await mongoose.model("Customer").countDocuments({ groups: groupId, marketer: marketerId });
  await CustomerGroupModel.updateOne({ _id: groupId }, { $set: { memberCount: count } });

  return { added: result.modifiedCount, memberCount: count };
};

/* ────── Remove members from group ────── */

export const removeGroupMembers = async ({ groupId, marketerId, customerIds }) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    const err = new Error("Invalid group ID");
    err.status = 400;
    throw err;
  }

  const group = await CustomerGroupModel.findOne({ _id: groupId, marketer: marketerId });
  if (!group) {
    const err = new Error("Group not found");
    err.status = 404;
    throw err;
  }

  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    const err = new Error("No customer IDs provided");
    err.status = 400;
    throw err;
  }

  const validIds = customerIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  await mongoose.model("Customer").updateMany(
    { _id: { $in: validIds }, marketer: marketerId },
    { $pull: { groups: groupId } }
  );

  // Update member count
  const count = await mongoose.model("Customer").countDocuments({ groups: groupId, marketer: marketerId });
  await CustomerGroupModel.updateOne({ _id: groupId }, { $set: { memberCount: count } });

  return { removed: true, memberCount: count };
};
