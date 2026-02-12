// src/payments/handlers/transfer.js
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
}