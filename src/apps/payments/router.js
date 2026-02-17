import express from "express";
import { verifyPaystackSignature } from "./hmac.js";
import { handleDepositEvent } from "./handlers/deposit.js";
import { handleTransferEvent } from "./handlers/transfer.js";

export function buildPaymentRouter() {
  const router = express.Router();

  router.get("", (_req, res) => {
    console.log("👀 Webhook GET test hit");
    res.status(200).send("Webhook alive");
  });

 /**
   * 2. MAIN WEBHOOK ENDPOINT
   * Handles final status updates (success, failed, etc.)
   */
  router.post("/", verifyPaystackSignature, async (req, res) => {
    try {
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
      // Always return 200 to Paystack for webhooks to avoid retries, 
      // unless you specifically want a retry.
      return res.status(200).json({ received: true });
    }
  });

  return router;
}

