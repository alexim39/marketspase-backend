import express from "express";
import {
  createCollection,
  listMyCollections,
  getCollection,
  updateCollection,
  updateCollectionProducts,
  deleteCollection,
  getPublicCollectionBySlug,
} from "../../../controllers/promotion/promoter-collections.controller.js";
import { authenticate } from "../../../../../shared/middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post("/", createCollection);
router.get("/", listMyCollections);
router.get("/:id", getCollection);
router.put("/:id", updateCollection);
router.put("/:id/products", updateCollectionProducts);
router.delete("/:id", deleteCollection);

export default router;
