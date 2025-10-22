import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { UserModel } from '../apps/user/models/user.model.js';

const ProfileImageRouter = express.Router();

// --- Multer Configuration ---

// Get directory paths
// NOTE: Using a direct relative path for consistency with the first example.
const uploadDir = 'src/uploads/profile/media';

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${req.params.userId}-${uniqueSuffix}${ext}`);
    }
});

// File filter to accept only JPEG and PNG images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG and PNG images are allowed'), false);
    }
};

// Configure multer upload middleware
const upload = multer({
    storage: storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
}).single('profilePicture');


// --- Routes ---

/**
 * @desc    Upload a new profile picture
 * @route   POST /api/profile/:userId
 * @access  Private
 */
ProfileImageRouter.post('/profile/:userId', async (req, res) => {
    // Wrap the entire logic within the multer upload callback,
    // consistent with the first example provided.
    upload(req, res, async (err) => {
        // Handle multer errors first
        if (err) {
            // If the error is a specific Multer error, return a 400 Bad Request
            if (err instanceof multer.MulterError) {
                return res.status(400).json({
                    success: false,
                    message: `Multer Error: ${err.message}`
                });
            } else if (err) { // Handle other errors from the fileFilter
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
        }

        const userId = req.params.userId;
        
        // If no file was uploaded, return an error
        if (!req.file) {
            return res.status(400).json({
                message: 'No file uploaded or file type not allowed',
                success: false
            });
        }

        try {
            // Find the current user
            const currentUser = await UserModel.findById(userId);
            if (!currentUser) {
                // If user not found, delete the uploaded file
                fs.unlinkSync(req.file.path);
                return res.status(404).json({
                    message: 'User not found.',
                    success: false
                });
            }

            // Delete old avatar if it exists and is not the default
            if (currentUser.avatar && currentUser.avatar !== 'img/avatar.png') {
                const oldAvatarPath = path.join(uploadDir, path.basename(currentUser.avatar));
                if (fs.existsSync(oldAvatarPath)) {
                    fs.unlinkSync(oldAvatarPath);
                }
            }

            // Construct URL path for the new avatar
            const domain ='https://davidotv-j3malln3.b4a.run';
            const avatarUrlPath = domain + `/uploads/profile/media/${req.file.filename}`;

            // Update user in database
            const updatedUser = await UserModel.findByIdAndUpdate(
                userId,
                { 
                    avatar: avatarUrlPath, // Store URL path
                    $set: { 'personalInfo.lastUpdated': new Date() }
                },
                { new: true, runValidators: true }
            );

            return res.status(200).json({
                message: 'Profile picture updated successfully',
                success: true,
                avatarUrl: avatarUrlPath,
                user: updatedUser
            });

        } catch (error) {
            console.error('Upload error:', error);
            // If a database error occurs, delete the uploaded file
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(500).json({
                message: error.message || 'Upload failed',
                success: false
            });
        }
    });
});

export default ProfileImageRouter;
