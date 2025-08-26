import { UserModel } from "../../user/models/user.model.js";
import { sendEmail } from "../../../services/emailService.js";
import { generateUniqueUsername } from '../services/username-generator.js'; 
import { ownerEmailTemplate } from '../services/email/ownerTemplate.js'; 
import { userWelcomeEmailTemplate } from '../services/email/userWelcomeTemplate.js';
import { CampaignModel } from "../../campaign/models/campaign.model.js"; // Add this import



// Authenticate/Verify User
export const Authenticate = async (req, res) => {
  try {
    const { firebaseUser } = req.body;

    // 1. Input Validation and Null Checks
    if (!firebaseUser) {
      return res.status(400).json({ success: false, message: "Missing Firebase user data" });
    }

    // Extract necessary data from firebaseUser
    const {
      uid,
      displayName,
      email,
      photoURL,
      providerData
    } = firebaseUser;

    // Determine authentication method from providerData
    const authProvider = providerData?.[0]?.providerId || 'local';

    // 2. Handle cases where email is not provided (e.g., Twitter)
    // We'll use the unique Firebase UID to find/create the user.
    // Let's create a combined unique identifier for the database
    //const uniqueIdentifier = email ? email : uid;

    let user = await UserModel.findOne({
      $or: [
        { email },
        { uid } 
      ]
    });

    // 3. User Existence Check and Creation
    if (!user) {
      // User does not exist, so create a new one.
      const username = await generateUniqueUsername(displayName);

      const newUser = {
        uid,
        displayName: displayName || 'User',
        username: username,
        authenticationMethod: authProvider,
        avatar: photoURL || 'img/avatar.png',
        // Set a placeholder password for social logins to prevent local password authentication.
        // The value should be secure and identifiable.
        //password: `__SOCIAL_${authProvider.toUpperCase().replace(/\./g, '_')}__`,
      };

      // Add email if it exists and is valid
      if (email) {
        newUser.email = email;
      }

      user = await UserModel.create(newUser);
      
      // Save the user to the database
      // await user.save(); // `create` method already saves the document.

      // Log the new user creation for monitoring
      //console.log(`New user created: ${user.username} via ${authProvider}`);

    } else {
      // 4. User Exists, Update Information
      // A user already exists, let's update their data if necessary.
      // This is useful for keeping their profile picture, display name, etc. up to date.
      // We'll update the `displayName` and `avatar` if they've changed.
      const updateFields = {};

      if (displayName && user.displayName !== displayName) {
        updateFields.displayName = displayName;
      }
      if (photoURL && user.avatar !== photoURL) {
        updateFields.avatar = photoURL;
      }
      if (authProvider && user.authenticationMethod !== authProvider) {
        updateFields.authenticationMethod = authProvider;
      }
      if (Object.keys(updateFields).length > 0) {
        await UserModel.updateOne({ _id: user._id }, { $set: updateFields });
        // Re-fetch the user to get the updated document, or update the `user` object in memory.
        Object.assign(user, updateFields);
      }
      
      console.log(`User ${user.username} logged in via ${authProvider}.`);
    }

    // 5. Respond with the User Data
    // Exclude the sensitive password field from the response.
    const userObject = user.toObject({ versionKey: false });
    delete userObject.password;

    res.status(200).json({
      success: true,
      message: `Signed in successfully with ${authProvider}`,
      //user: userObject,
    });

  } catch (error) {
    console.error("Authentication Error:", error);
    // Handle potential duplicate username/email errors gracefully
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A user with this email or username already exists." });
    }
    res.status(500).json({ success: false, message: "Internal server error during authentication." });
  }
};


/**
 * Controller to get a user's record by their UID.
 * This function handles the incoming HTTP request and returns the user data.
 */
export const GetUser = async (req, res) => {
  try {
    // 1. Extract the UID from the URL parameters
    // The client-side code `auth/${uid}` means `uid` will be available in `req.params`.
    const { uid } = req.params;

    // 2. Validate the incoming UID
    if (!uid) {
      return res.status(400).json({ success: false, message: "User ID (UID) is required." });
    }

    // 3. Query the database for the user by their UID
    // Use the `findOne` method on the `uid` field, which should be indexed for performance.
    const user = await UserModel.findOne({ uid: uid }).exec();

    // 4. Handle the case where the user is not found
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // 5. Secure the response by removing sensitive data
    // It's a best practice to never expose the password hash to the client.
    const userObject = user.toObject();
    delete userObject.password;

    // Fetch campaigns where this user is the owner
    userObject.campaigns = await CampaignModel.find({ owner: user._id });

    // 6. Send a successful response with the user data
    res.status(200).json({ 
      success: true, 
      data: userObject,
      message: "User found successfully"
    });

  } catch (error) {
    // 7. Handle any server-side errors
    console.error("Error in getUser controller:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
