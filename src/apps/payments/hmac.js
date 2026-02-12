// src/payments/hmac.js
import crypto from "crypto";

const SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACKTOKEN;

export function verifyPaystackSignature(req, res, next) {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!SECRET || !signature || !req.rawBody) {
      return res.status(401).send("Invalid signature");
    }
    const hash = crypto.createHmac("sha512", SECRET).update(req.rawBody).digest("hex");
    if (hash !== signature) return res.status(401).send("Invalid signature");
    next();
  } catch {
    return res.status(401).send("Invalid signature");
  }
}