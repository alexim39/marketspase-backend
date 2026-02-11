// paystack-deposit-webhook.js
import { UserModel } from "../../user/models/user.model.js";
import crypto from "crypto";

const PAYSTACK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACKTOKEN;

export const handleDepositWebhook = async (req, res) => {
  try {
    // ---------------------------
    // 1️⃣ Verify Paystack Signature
    // ---------------------------
    const signature = req.headers["x-paystack-signature"];
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(req.rawBody)
      .digest("hex");

    if (hash !== signature) {
      console.log("❌ Invalid Paystack signature (deposit)");
      return res.status(401).send("Invalid signature");
    }

    // ---------------------------
    // 2️⃣ Parse event
    // ---------------------------
    const event = req.body;
    const eventType = event?.event;
    const data = event?.data;

    if (!data?.reference) {
      console.log("❌ No reference in Paystack deposit webhook.");
      return res.status(200).send("ok");
    }

    const reference = data.reference;

    // We only handle DEPOSITS here
    if (eventType !== "charge.success" && eventType !== "charge.failed") {
      return res.status(200).send("ignored");
    }

    console.log(`💡 Deposit Webhook Received: ${eventType} for reference ${reference}`);

    // -------------------------------------------------------------
    // 3️⃣ Find the marketer who initialized this deposit transaction
    // -------------------------------------------------------------
    const users = await UserModel.find({
      "wallets.marketer.transactions.reference": reference
    });

    if (!users.length) {
      console.log(`⚠ No marketer found for deposit reference ${reference}`);
      return res.status(200).send("ok");
    }

    const user = users[0];
    const marketerWallet = user.wallets.marketer;

    // Find the transaction inside marketer wallet
    const txIndex = marketerWallet.transactions.findIndex(
      (tx) => tx.reference === reference
    );

    if (txIndex === -1) {
      console.log(`⚠ Transaction not found for deposit reference ${reference}`);
      return res.status(200).send("ok");
    }

    const tx = marketerWallet.transactions[txIndex];

    // Idempotency: if already finalized, return safely
    if (["successful", "failed"].includes(tx.status)) {
      console.log(`⚠ Deposit already finalized: ${reference}`);
      return res.status(200).send("ok");
    }

    // -------------------------------
    // 4️⃣ Process charge.success event
    // -------------------------------
    if (eventType === "charge.success" && data.status === "success") {

      const amountKobo = Number(data.amount);      // Paystack returns in KOBO
      const feePercent = 0.10;                    // Your 10% fee
      const serviceFee = Math.round(amountKobo * feePercent);
      const netAmount = amountKobo - serviceFee;

      // Update transaction details
      tx.status = "successful";
      tx.processedAt = new Date();
      tx.fee = serviceFee;
      tx.meta = { ...(tx.meta || {}), webhook: "charge.success" };

      // Credit marketer wallet exactly ONCE
      marketerWallet.balance += netAmount;

      console.log(
        `💰 Deposit SUCCESS for marketer ${user._id}: Gross=${amountKobo/100}, Fee=${serviceFee/100}, Net=${netAmount/100}`
      );

      await user.save();

      return res.status(200).send("ok");
    }

    // ------------------------------
    // 5️⃣ Process charge.failed event
    // ------------------------------
    if (eventType === "charge.failed") {
      tx.status = "failed";
      tx.failureReason = data.gateway_response;
      tx.processedAt = new Date();
      tx.meta = { ...(tx.meta || {}), webhook: "charge.failed" };

      await user.save();

      console.log(`❌ Deposit FAILED for reference ${reference}`);
      return res.status(200).send("ok");
    }

    return res.status(200).send("ok");

  } catch (err) {
    console.error("❗ Deposit webhook error:", err);
    return res.status(200).send("ok"); // Always return 200 so Paystack doesn't retry too much
  }
};