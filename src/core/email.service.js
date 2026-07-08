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
export const sendEmail = async (emailOrOptions, maybeSubject, maybeHtml) => {
  let to, subject, htmlContent;

  if (typeof emailOrOptions === 'object' && emailOrOptions !== null) {
    to = emailOrOptions.to;
    subject = emailOrOptions.subject;
    htmlContent = emailOrOptions.html;
  } else {
    to = emailOrOptions;
    subject = maybeSubject;
    htmlContent = maybeHtml;
  }

  if (!to) {
    console.error('Email send failed — no recipient');
    return;
  }

  try {
    await transporter.sendMail({
      from: emailFrom,
      to,
      subject: subject || '',
      html: htmlContent || '',
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Email send failed — to:${to} subject:"${subject}" host:${process.env.EMAIL_HOST} user:${emailUser} error:${error.message}`);
  }
};
