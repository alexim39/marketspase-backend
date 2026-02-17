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



  // src/payments/handlers/transfer.js
import { finalizeTransfer } from "../services/finalize.js";

export async function handleTransferEvent(event) {
  const type = event?.event;
  const data = event?.data;

  // 1. Structural Guard: Ensure data and reference exist
  if (!data || !data.reference) {
    console.error("Missing transfer data or reference:", event);
    return;
  }

  const reference = data.reference;
  const amountKobo = Number(data.amount || 0);

  // 2. Define valid statuses
  const validStatuses = [
    "transfer.success", 
    "transfer.failed", 
    "transfer.reversed", 
    "transfer.pending"
  ];

  if (validStatuses.includes(type)) {
    // Strip "transfer." prefix to get status: "success", "failed", etc.
    const status = type.split(".")[1]; 
    
    console.log(`Processing transfer ${reference} with status: ${status}`);
    
    await finalizeTransfer(reference, status, amountKobo, { 
      ...data, 
      event_type: type 
    });
  } else {
    console.warn(`Unhandled transfer event type: ${type}`);
  }
}
