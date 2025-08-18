import {ContactModel} from '../models/contact.model.js';
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

        //console.log('sent==',req.body);

        const contactObject = await ContactModel.create({
            name: req.body.name,
            surname: req.body.surname,
            reason: req.body.reason,
            email: req.body.email,
            subject: req.body.subject,
            message: req.body.message,
            requestID: requestID
        });

        // Send email to form owner
        const ownerSubject = 'DavidoTV Contact Request';
        const ownerMessage = ownerContactEmailTemplate(contactObject);
        const ownerEmails = ['ago.fnc@gmail.com', 'contact@davidotv.com'];
        await Promise.all(ownerEmails.map(email => sendEmail(email, ownerSubject, ownerMessage)));

        // Send email to the user
        const userSubject = `DavidoTV Contact Request - ${requestID}`;
        const userMessage = userContactEmailTemplate(contactObject);
        const receiverEmails = [contactObject.email, ];
        await Promise.all(receiverEmails.map(email => sendEmail(email, userSubject, userMessage)));

        res.status(200).json({data: contactObject, success: true, message: "Request submitted successfully, you will be contacted soon"});

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'internal server error',
            success: false,
        })
    }
}
