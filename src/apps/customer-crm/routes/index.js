import express from "express";
import CustomerRouter from "./customer.routes.js";
import GroupRouter from "./group.routes.js";

const CrmRouter = express.Router();

CrmRouter.use("/customers", CustomerRouter);
CrmRouter.use("/customer-groups", GroupRouter);

export default CrmRouter;
