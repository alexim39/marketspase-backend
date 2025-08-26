import {ContactModel} from '../models/contact.model.js';
import { UserModel} from '../../user/models/user.model.js';
import { sendEmail } from "../../../services/emailService.js";
import { ownerContactEmailTemplate } from '../services/email/ownerTemplate.js';
import { userContactEmailTemplate } from '../services/email/userTemplate.js';


//generate a numerical id.
function generateNumericContactRequestId(length = 8) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 10); // Generates a random digit (0-9)
    }
    return result;
}

// User contact contnroller
export const ContactController = async (req, res) => {
    const requestID = generateNumericContactRequestId();
    try {
        const { userId, reason, subject, message } = req.body;

        // Find the user by their ID
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found.',
                success: false,
            });
        }
        
        const contactObject = await ContactModel.create({
            user: user._id, // Use the user's ObjectId
            reason,
            subject,
            message,
            requestID: requestID
        });

        // Send email to form owner
//         const ownerSubject = 'MarketSpase Contact Request';
//         const ownerMessage = ownerContactEmailTemplate(contactObject);
//         const ownerEmails = ['ago.fnc@gmail.com'];
//         await Promise.all(ownerEmails.map(email => sendEmail(email, ownerSubject, ownerMessage)));

//         // Send email to the user
//         const userSubject = `MarketSpase Contact Request - ${requestID}`;
//         const userMessage = userContactEmailTemplate(contactObject);
//         const receiverEmails = [user.email]; // Use the user's email from the database
//         await Promise.all(receiverEmails.map(email => sendEmail(email, userSubject, userMessage)));

        res.status(200).json({data: contactObject, success: true, message: "Request submitted successfully, you will hear from us soon"});

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'internal server error',
            success: false,
        })
    }
}