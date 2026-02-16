import express from "express";
import { verifyPaystackSignature } from "./hmac.js";
import { handleDepositEvent } from "./handlers/deposit.js";
import { handleTransferEvent } from "./handlers/transfer.js";

export function buildPaymentRouter() {
  const router = express.Router();

  router.post(
    "", // <-- FIXED (accepts /api/webhook/paystack without trailing slash)
    express.raw({ type: "application/json" }),
    (req, _res, next) => {
      req.rawBody = req.body;
      try {
        req.body = JSON.parse(req.body);
      } catch {
        req.body = {};
      }
      next();
    },
    verifyPaystackSignature,
    async (req, res) => {
      try {
        console.log("🔥 Paystack webhook received:", req.body?.event);

        const event = req.body;
        const type = event?.event || "";

        if (type.startsWith("charge.")) {
          await handleDepositEvent(event);
        } else if (type.startsWith("transfer.")) {
          await handleTransferEvent(event);
        }

        return res.status(200).json({ received: true });
      } catch (err) {
        console.error("Webhook error:", err);
        return res.status(200).json({ received: true });
      }
    }
  );

  return router;
}