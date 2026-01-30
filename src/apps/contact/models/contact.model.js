/* import mongoose from 'mongoose';


const contactSchema = mongoose.Schema(
    {
        user: {
             type: mongoose.Schema.Types.ObjectId,
             ref: "User",
             required: true,
           },
        reason: {
            type: String,
            required: [true, "Please enter reason"]
        },
        subject: {
            type: String,
            //unique: true,
            required: [true, "Please enter subject"]
        },
        message: {
            type: String,
            //unique: true,
            required: [true, "Please enter message"]
        },
        status: {
            type: String,
            default: 'Open',
            //required: [true, "Please enter username"]
        },
        requestID: {
            type: String,
            default: 'Open',
            //required: [true, "Please enter username"]
        },
        
       
    },
    {
        timestamps: true
    }
)

export const ContactModel = mongoose.model('Contact', contactSchema); */


import mongoose from 'mongoose';

const contactSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        reason: {
            type: String,
            required: [true, "Please enter reason"],
            enum: ['general', 'technical', 'billing', 'feedback', 'report', 'other']
        },
        subject: {
            type: String,
            required: [true, "Please enter subject"],
            trim: true,
            maxlength: 200
        },
        message: {
            type: String,
            required: [true, "Please enter message"],
            trim: true
        },
        status: {
            type: String,
            enum: ['open', 'in_progress', 'resolved', 'closed', 'spam'],
            default: 'open',
            index: true
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium',
            index: true
        },
        category: {
            type: String,
            enum: ['support', 'feature_request', 'bug_report', 'complaint', 'praise', 'partnership'],
            default: 'support'
        },
        requestID: {
            type: String,
            unique: true,
            default: function() {
                return 'CT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            }
        },
        attachments: [{
            filename: String,
            url: String,
            fileType: String,
            size: Number,
            uploadedAt: { type: Date, default: Date.now }
        }],
        adminNotes: [{
            admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            note: String,
            createdAt: { type: Date, default: Date.now }
        }],
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        resolvedAt: {
            type: Date,
            default: null
        },
        resolutionNotes: {
            type: String,
            default: ''
        },
        userEmail: {
            type: String,
            required: true,
            match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
        },
        userPhone: {
            type: String,
            default: null
        },
        metadata: {
            ipAddress: String,
            userAgent: String,
            browser: String,
            os: String,
            deviceType: String
        },
        followUpDate: {
            type: Date,
            default: null
        },
        tags: [{
            type: String,
            trim: true
        }],
        isRead: {
            type: Boolean,
            default: false
        },
        isArchived: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

// Indexes for better query performance
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ priority: 1, createdAt: -1 });
contactSchema.index({ user: 1, createdAt: -1 });
contactSchema.index({ category: 1, createdAt: -1 });
contactSchema.index({ assignedTo: 1, status: 1 });

// Pre-save middleware to validate
contactSchema.pre('save', function(next) {
    if (this.status === 'resolved' || this.status === 'closed') {
        this.resolvedAt = new Date();
    }
    next();
});

// Instance methods
contactSchema.methods = {
    addAdminNote(adminId, note) {
        this.adminNotes.push({ admin: adminId, note });
        return this.save();
    },
    
    assignTo(adminId) {
        this.assignedTo = adminId;
        return this.save();
    },
    
    markAsRead() {
        this.isRead = true;
        return this.save();
    },
    
    updateStatus(newStatus, resolutionNotes = '') {
        this.status = newStatus;
        if (newStatus === 'resolved' || newStatus === 'closed') {
            this.resolvedAt = new Date();
            this.resolutionNotes = resolutionNotes;
        }
        return this.save();
    }
};

// Static methods
contactSchema.statics = {
    async getStats() {
        const stats = await this.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgResponseTime: { $avg: { $subtract: ['$updatedAt', '$createdAt'] } }
                }
            }
        ]);
        
        const total = await this.countDocuments();
        const openTickets = await this.countDocuments({ status: 'open' });
        const highPriority = await this.countDocuments({ priority: 'high', status: { $in: ['open', 'in_progress'] } });
        
        return {
            byStatus: stats,
            total,
            openTickets,
            highPriority,
            averageResponseTime: stats.length ? 
                Math.round(stats.reduce((acc, curr) => acc + curr.avgResponseTime, 0) / stats.length) : 0
        };
    },
    
    async getByAssignee(adminId) {
        return this.find({ assignedTo: adminId })
            .populate('user', 'username displayName avatar')
            .populate('assignedTo', 'username displayName')
            .sort({ priority: -1, createdAt: -1 });
    }
};

export const ContactModel = mongoose.model('Contact', contactSchema);
