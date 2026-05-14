import mongoose from "mongoose";
import paymentSchema from "./payment.schema.js";
import { setupPaymentVirtuals } from "./payment.virtuals.js";
import { setupPaymentMethods } from "./payment.methods.js";
import { setupPaymentStatics } from "./payment.statics.js";
import { setupPaymentMiddleware } from "./payment.middleware.js";
import { setupPaymentIndexes } from "./payment.indexes.js";

// Setup all schema extensions
setupPaymentVirtuals(paymentSchema);
setupPaymentMethods(paymentSchema);
setupPaymentStatics(paymentSchema);
setupPaymentMiddleware(paymentSchema);
setupPaymentIndexes(paymentSchema);

export const PaymentModel = mongoose.model("Payment", paymentSchema);