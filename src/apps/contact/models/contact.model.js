import mongoose from 'mongoose';


/* Schema*/
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

/* Model */
export const ContactModel = mongoose.model('Contact', contactSchema);