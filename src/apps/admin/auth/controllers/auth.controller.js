import bcrypt from "bcryptjs";
//import crypto from 'crypto';
import jwt from "jsonwebtoken";
import dotenv  from "dotenv"
import { AdminModel } from './../../user/models/admin.model.js'
dotenv.config()


// Create a new admin user
export const createAdmin = async (req, res) => {
    try {
        const { email, password, name, role } = req.body;

        // 1. Basic input validation
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        // 2. Check if a user with this email already exists
        const existingAdmin = await AdminModel.findOne({ email });
        if (existingAdmin) {
            return res.status(409).json({ success: false, message: "An admin with this email already exists" });
        }

        // 3. Create a new Admin instance
        // The password hashing will be handled by the pre-save hook in your AdminModel
        const newAdmin = new AdminModel({
            email,
            password,
            name,
            role
        });

        // 4. Save the new admin to the database
        const savedAdmin = await newAdmin.save();

        // 5. Omit the password from the response for security
        const { password: _, ...adminObject } = savedAdmin.toObject();

        // 6. Send a success response
        res.status(201).json({ 
            success: true, 
            message: "Admin user created successfully",
            admin: adminObject 
        });

    } catch (error) {
        console.error("Error creating admin user:", error);
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }

        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// login
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('request ',req.body)

    // MODIFIED: Use `.select('+password')` to explicitly include the password field
    const user = await AdminModel.findOne({ email }).select('+password');

    // Now, `user.password` will contain the hashed password from the database
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ success: false, message: "Wrong email or password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWTTOKENSECRET, {
      expiresIn: "1d",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ success: true, message: "SignedIn" });

  } catch (error) {
    console.error("Error getting admin user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Logout
export const signout = async (req, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.json({ success: true, message: "Logged out successfully" });
};

// Get admin details
export const getAdmin = async (req, res) => {
  try {
    const token = req.cookies["jwt"];
    
    if (!token) {
      return res.status(401).json({ success: false, message: "User unauthenticated: JWT missing" });
    }

    const claims = jwt.verify(token, process.env.JWTTOKENSECRET);

    if (!claims) {
      return res.status(401).json({ success: false, message: "User unauthenticated: JWT invalid" });
    }

    const user = await AdminModel.findById(claims.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { password: _, ...userObject } = user.toJSON(); // Remove password from response

    res.status(200).json({success: true,  user: userObject});
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: "User unauthenticated: JWT expired" });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: "User unauthenticated: Invalid JWT" });
    }
    console.error("Error getting partner:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};