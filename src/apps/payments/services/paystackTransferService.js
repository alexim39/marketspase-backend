// src/payments/services/paystackTransferService.js
import axios from "axios";
import { UserModel } from "../../user/models/user.model.js";

const PAYSTACK_BASE = "https://api.paystack.co";
const SECRET = process.env.PAYSTACK_SECRET_KEY;

const headers = {
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json"
};

if (!SECRET) {
  console.warn("⚠ PAYSTACK_SECRET_KEY is not set");
}

/** Ensure a Paystack transfer recipient exists for (bankCode, accountNumber). */
export async function getOrCreateRecipient({
  userId,
  name,
  accountNumber,
  bankCode,
  currency = "NGN",
}) {
  // 1️⃣ Reuse cached recipient_code if present
  if (userId) {
    const user = await UserModel.findById(userId);
    if (user?.savedAccounts?.length) {
      const acct = user.savedAccounts.find(
        a => a.accountNumber === accountNumber &&
             a.bankCode === bankCode &&
             a.recipientCode
      );
      if (acct?.recipientCode) return acct.recipientCode;
    }
  }

  // 2️⃣ Create at Paystack
  const resp = await axios.post(
    `${PAYSTACK_BASE}/transferrecipient`,
    {
      type: "nuban",
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency
    },
    { headers }
  );

  const recipientCode = resp?.data?.data?.recipient_code;
  if (!recipientCode) {
    throw new Error(resp?.data?.message || "Failed to create recipient");
  }

  // 3️⃣ Cache in savedAccounts
  if (userId) {
    const user = await UserModel.findById(userId);
    if (user) {
      let acct = user.savedAccounts?.find(
        a => a.accountNumber === accountNumber && a.bankCode === bankCode
      );

      if (!acct) {
        user.savedAccounts.push({
          bank: "",
          bankCode,
          accountNumber,
          accountName: name,
          isDefault: false,
          recipientCode,
          verified: true,
          verifiedAt: new Date(),
          firstUsed: new Date(),
          lastUsed: new Date(),
        });
      } else {
        acct.recipientCode = recipientCode;
        acct.lastUsed = new Date();
      }

      await user.save();
    }
  }

  return recipientCode;
}

/** Initiate a transfer with KOBO amount. Optional `reference` for idempotency. */
export async function initiateTransfer({
  amountKobo,
  recipientCode,
  reason = "Withdrawal Payment - MarketSpase",
  reference,
}) {
  const payload = {
    source: "balance",
    amount: amountKobo,
    recipient: recipientCode,
    reason,
  };

  if (reference) payload.reference = reference;

  const resp = await axios.post(`${PAYSTACK_BASE}/transfer`, payload, { headers });

  const ok = resp?.data?.status === true;
  const d = resp?.data?.data || {};
  const status = d?.status || (ok ? "pending" : "failed");

  return {
    raw: resp?.data,
    ok,
    status,
    transfer_code: d?.transfer_code || null,
    reference: d?.reference || reference || null,
    message: d?.reason || resp?.data?.message || "",
  };
}

/** 🔥 NEW — Approve transfer when Paystack requires approval */
/** 🔥 FINALIZE transfer for automatic approval accounts */
export async function approveTransfer(transferCode) {
  try {
    console.log("🔐 Finalizing transfer:", transferCode);

    const resp = await axios.post(
      `${PAYSTACK_BASE}/transfer/finalize_transfer`,
      {
        transfer_code: transferCode,
        otp: "000000" // Required for auto-approved transfers
      },
      { headers }
    );

    console.log("✅ Transfer finalized:", resp?.data);

    return resp?.data;
  } catch (err) {
    console.error(
      "❌ Paystack approveTransfer failed:",
      err?.response?.data || err.message
    );
    throw err;
  }
}

/** Verify by reference (preferred) */
export async function verifyTransferByReference(ref) {
  const { data } = await axios.get(
    `${PAYSTACK_BASE}/transfer/verify/${ref}`,
    { headers }
  );
  return data;
}

/** Fallback: fetch by transfer_code */
export async function fetchTransferByCode(transferCode) {
  const { data } = await axios.get(
    `${PAYSTACK_BASE}/transfer/${transferCode}`,
    { headers }
  );
  return data;
}