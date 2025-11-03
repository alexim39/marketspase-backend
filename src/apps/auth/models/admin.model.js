import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const AdminSchema = new mongoose.Schema({
    // The email property is used to find the user during sign-in.
    // It is required and must be unique to prevent duplicate accounts.
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
    },
    // The password property stores the hashed password for security.
    // The select: false option prevents the password from being returned
    // by default on queries, which is a good security practice.
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false,
    },
    // This is where you can add other fields for your admin,
    // like a name, role, etc., if needed in the future.
    name: {
        type: String,
        trim: true,
    },
    role: {
        type: String,
        enum: ['admin', 'super-admin'],
        default: 'admin',
    },
}, {
    timestamps: true, // This automatically adds `createdAt` and `updatedAt` fields
});

// Pre-save hook to hash the password before saving a new user
// This ensures that the password is never stored in plain text.
AdminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Export the model
export const AdminModel = mongoose.model('Admin', AdminSchema);