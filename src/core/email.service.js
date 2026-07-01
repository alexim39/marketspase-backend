import nodemailer from 'nodemailer';

const emailUser = process.env.EMAIL_USER || 'supports@marketspase.com';
const emailFrom = process.env.EMAIL_FROM || `"MarketSpase" <${emailUser}>`;

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'marketspase.com',
  secure: process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : true,
  port: Number(process.env.EMAIL_PORT || 465),
  auth: {
    user: emailUser,
    pass: process.env.EMAILPASS, // stored in environment variables
  },
});

// Reusable function to send emails
export const sendEmail = async (email, subject, htmlContent) => {
  try {
    await transporter.sendMail({
      from: emailFrom,
      to: email,
      subject: subject,
      html: htmlContent,
    });
    console.log(`Email sent to ${email}`);
  } catch (error) {
    console.error(`Error sending email to ${email}: ${error.message}`);
  }
};
