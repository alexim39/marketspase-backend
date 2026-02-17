/* // src/payments/handlers/transfer.js
import { finalizeTransfer } from "../services/finalize.js";

export async function handleTransferEvent(event) {
  const type = event?.event || "";
  const data = event?.data;
  const reference = data?.reference;
  if (!reference) return;

  const amountKobo = Number(data.amount || 0);

  if (type === "transfer.success") {
    await finalizeTransfer(reference, "success", amountKobo, { ...data, event: type });
  } else if (type === "transfer.failed") {
    await finalizeTransfer(reference, "failed", amountKobo, { ...data, event: type });
  } else if (type === "transfer.reversed") {
    await finalizeTransfer(reference, "reversed", amountKobo, { ...data, event: type });
  } else if (type === "transfer.pending") {
    await finalizeTransfer(reference, "pending", amountKobo, { ...data, event: type });
  }
} */


import { finalizeTransfer } from "../services/finalize.js";
import { approveTransfer } from "../services/paystackTransferService.js";

export async function handleTransferEvent(event) {
  const type = event?.event || "";
  const data = event?.data || {};
  const reference = data?.reference;
  const transferCode = data?.transfer_code;
  const status = data?.status;

  console.log("📩 Transfer event received:", type, "| Status:", status);

  if (!reference) return;

  const amountKobo = Number(data.amount || 0);

  // 🔐 HANDLE APPROVAL TRIGGER
  if (
    type === "transfer.requires_approval" ||
    (type === "transfer.created" && status === "blocked")
  ) {
    console.log("🔐 Transfer requires approval:", reference);

    try {
      if (transferCode) {
        await approveTransfer(transferCode);
        console.log("✅ Transfer approved automatically:", transferCode);
      } else {
        console.log("⚠ No transfer code found for approval");
      }
    } catch (err) {
      console.error("❌ Failed to approve transfer:", err?.response?.data || err.message);
    }

    return;
  }

  // Final states
  if (type === "transfer.success") {
    await finalizeTransfer(reference, "success", amountKobo, { ...data, event: type });
  } 
  else if (type === "transfer.failed") {
    await finalizeTransfer(reference, "failed", amountKobo, { ...data, event: type });
  } 
  else if (type === "transfer.reversed") {
    await finalizeTransfer(reference, "reversed", amountKobo, { ...data, event: type });
  } 
  else if (type === "transfer.pending") {
    await finalizeTransfer(reference, "pending", amountKobo, { ...data, event: type });
  }
}