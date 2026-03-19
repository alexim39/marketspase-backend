import mongoose from "mongoose";
import notificationSchema from "./notification.schema.js";
import { setupNotificationVirtuals } from "./notification.virtuals.js";
import { setupNotificationMethods } from "./notification.methods.js";
import { setupNotificationStatics } from "./notification.statics.js";
import { setupNotificationMiddleware } from "./notification.middleware.js";
import { setupNotificationIndexes } from "./notification.indexes.js";

// Setup all schema extensions
setupNotificationVirtuals(notificationSchema);
setupNotificationMethods(notificationSchema);
setupNotificationStatics(notificationSchema);
setupNotificationMiddleware(notificationSchema);
setupNotificationIndexes(notificationSchema);

export const NotificationModel = mongoose.model("Notification", notificationSchema);