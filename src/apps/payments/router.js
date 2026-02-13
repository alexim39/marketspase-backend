// src/payments/router.js
import express from "express";
import { verifyPaystackSignature } from "./hmac.js";
import { handleDepositEvent } from "./handlers/deposit.js";
import { handleTransferEvent } from "./handlers/transfer.js";

export function buildPaymentRouter() {
  const router = express.Router();

  router.post(
    "/",
    // RAW parser to compute HMAC on exact bytes
    express.raw({ type: "application/json" }),
    (req, _res, next) => { req.rawBody = req.body; try { req.body = JSON.parse(req.body); } catch { req.body = {}; } next(); },
    verifyPaystackSignature,
    async (req, res) => {
      try {
        const event = req.body;
        const type = event?.event || "";

        if (type.startsWith("charge.")) {
          await handleDepositEvent(event);
        } else if (type.startsWith("transfer.")) {
          await handleTransferEvent(event);
        } else {
          // ignore other events
        }

        return res.status(200).json({ received: true });
      } catch (err) {
        console.error("Webhook error:", err);
        // Always ack to avoid retries; recon will fix
        return res.status(200).json({ received: true });
      }
    }
  );

  return router;
}