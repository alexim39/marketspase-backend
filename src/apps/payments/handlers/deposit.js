// src/payments/handlers/deposit.js
import { finalizeDeposit } from "../services/finalize.js";

export async function handleDepositEvent(event) {
  const type = event?.event;
  const data = event?.data;
  const reference = data?.reference;
  if (!reference) return;

  if (type === "charge.success" && data?.status === "success") {
    const amountKobo = Number(data.amount || 0); // Paystack KOBO
    await finalizeDeposit(reference, amountKobo, event);
  } else if (type === "charge.failed") {
    // Optional: mark tx failed if present (no wallet effect)
  }
}