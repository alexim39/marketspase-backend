import express from "express";
import { authenticate } from "../../../shared/middleware/auth.middleware.js";
import {
  getGroups,
  createGroupHandler,
  updateGroupHandler,
  deleteGroupHandler,
  addGroupMembersHandler,
  removeGroupMembersHandler,
} from "../controllers/group.controller.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getGroups);
router.post("/", createGroupHandler);
router.patch("/:id", updateGroupHandler);
router.delete("/:id", deleteGroupHandler);
router.post("/:id/members", addGroupMembersHandler);
router.delete("/:id/members", removeGroupMembersHandler);

export default router;
