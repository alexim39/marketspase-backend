import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMembers,
  removeGroupMembers,
} from "../services/index.js";

/**
 * @desc    List contact groups for the marketer
 * @route   GET /api/v1/customer-groups
 * @access  Private (Marketer)
 */
export const getGroups = async (req, res) => {
  try {
    const data = await listGroups({ marketerId: req.userId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get groups error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load groups",
    });
  }
};

/**
 * @desc    Create a contact group
 * @route   POST /api/v1/customer-groups
 * @access  Private (Marketer)
 */
export const createGroupHandler = async (req, res) => {
  try {
    const group = await createGroup({
      marketerId: req.userId,
      data: req.body,
    });

    return res.status(201).json({ success: true, data: group });
  } catch (error) {
    console.error("Create group error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to create group",
    });
  }
};

/**
 * @desc    Update a contact group
 * @route   PATCH /api/v1/customer-groups/:id
 * @access  Private (Marketer)
 */
export const updateGroupHandler = async (req, res) => {
  try {
    const group = await updateGroup({
      groupId: req.params.id,
      marketerId: req.userId,
      data: req.body,
    });

    return res.status(200).json({ success: true, data: group });
  } catch (error) {
    console.error("Update group error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to update group",
    });
  }
};

/**
 * @desc    Delete a contact group
 * @route   DELETE /api/v1/customer-groups/:id
 * @access  Private (Marketer)
 */
export const deleteGroupHandler = async (req, res) => {
  try {
    const result = await deleteGroup({
      groupId: req.params.id,
      marketerId: req.userId,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Delete group error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to delete group",
    });
  }
};

/**
 * @desc    Add members to a group
 * @route   POST /api/v1/customer-groups/:id/members
 * @access  Private (Marketer)
 */
export const addGroupMembersHandler = async (req, res) => {
  try {
    const result = await addGroupMembers({
      groupId: req.params.id,
      marketerId: req.userId,
      customerIds: req.body.customerIds,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Add group members error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to add members to group",
    });
  }
};

/**
 * @desc    Remove members from a group
 * @route   DELETE /api/v1/customer-groups/:id/members
 * @access  Private (Marketer)
 */
export const removeGroupMembersHandler = async (req, res) => {
  try {
    const result = await removeGroupMembers({
      groupId: req.params.id,
      marketerId: req.userId,
      customerIds: req.body.customerIds,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Remove group members error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to remove members from group",
    });
  }
};
