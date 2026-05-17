import express from "express";
import collaborationRoutes from "./routes/collaboration.routes.js";

const CollaborationRouter = express.Router();

CollaborationRouter.use("/", collaborationRoutes);

export default CollaborationRouter;
