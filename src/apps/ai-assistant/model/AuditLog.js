import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ipAddress: String,
}, { timestamps: true });

export default mongoose.model('AuditLog', auditLogSchema);