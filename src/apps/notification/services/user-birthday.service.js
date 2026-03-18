
// src/apps/user/services/user-birthday.service.js
import { UserModel } from './../../user/models/user.model.js';
import { NotificationService } from './notification.service.js';
import { sendEmail } from '../../../core/email.service.js';
import { userBirthdayEmailTemplate } from './email/userBirthdayTemplate.js';
import mongoose from 'mongoose';

export const userBirthdayService = async () => {
  const jobStartTime = new Date();
  console.log(`🎂 [${jobStartTime.toISOString()}] Birthday notification service started`);
  
  try {
    // Get today's date in local time (considering user's timezone)
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
    const todayDay = today.getDate();
    
    console.log(`📅 Checking for birthdays on: ${todayMonth}/${todayDay}`);
    
    // Find users whose birthday is today
    // Note: This assumes dob is stored as Date in MongoDB
    // We need to match month and day regardless of year
    const birthdayUsers = await UserModel.aggregate([
      {
        $match: {
          'personalInfo.dob': { $exists: true, $ne: null },
          'isActive': true,
          'isDeleted': false,
          // Check notification preferences for birthday emails
          $or: [
            { 'notificationSettings.weeklySummary.email': { $ne: false } },
            { 'notificationSettings.weeklySummary.email': { $exists: false } }
          ]
        }
      },
      {
        $addFields: {
          dobMonth: { $month: '$personalInfo.dob' },
          dobDay: { $dayOfMonth: '$personalInfo.dob' }
        }
      },
      {
        $match: {
          dobMonth: todayMonth,
          dobDay: todayDay
        }
      },
      {
        $project: {
          uid: 1,
          email: 1,
          displayName: 1,
          role: 1,
          avatar: 1,
          'personalInfo.dob': 1,
          'wallets.promoter.balance': 1,
          'wallets.marketer.balance': 1,
          rating: 1,
          ratingCount: 1,
          testimonials: 1,
          'referralInfo.totalReferrals': 1,
          'referralInfo.totalEarned': 1,
          'notificationSettings': 1,
          createdAt: 1
        }
      }
    ]);
    
    console.log(`👤 Found ${birthdayUsers.length} users with birthdays today`);
    
    let notificationsSent = 0;
    let emailsSent = 0;
    let failed = 0;
    
    // Send birthday messages to each user
    for (const user of birthdayUsers) {
      try {
        const session = await mongoose.startSession();
        
        try {
          await session.startTransaction();
          
          // 1. Add birthday bonus to user's wallet based on role
          const bonusAmount = 50; // ₦50 birthday bonus
          const isPromoter = user.role === 'promoter';
          const isMarketer = user.role === 'marketer';
          const walletField = isPromoter ? 'promoter' : 'marketer';
          
          // Add birthday bonus to user's balance
          await UserModel.updateOne(
            { _id: user._id },
            {
              $inc: {
                [`wallets.${walletField}.balance`]: bonusAmount
              },
              $push: {
                [`wallets.${walletField}.transactions`]: {
                  _id: new mongoose.Types.ObjectId(),
                  amount: bonusAmount,
                  type: 'credit',
                  category: 'birthday_bonus',
                  description: 'Happy Birthday Bonus 🎂',
                  status: 'successful',
                  createdAt: new Date(),
                  metadata: {
                    isBirthdayBonus: true,
                    birthdayYear: today.getFullYear()
                  }
                }
              },
              $set: {
                lastBirthdayBonus: today // Track when last bonus was given
              }
            },
            { session }
          );
          
          // 2. Log birthday activity
          await UserModel.findByIdAndUpdate(
            user._id,
            {
              $push: {
                activityLog: {
                  action: 'birthday_bonus_received',
                  description: `Received ₦${bonusAmount} birthday bonus`,
                  timestamp: new Date(),
                  metadata: {
                    bonusAmount,
                    birthdayDate: user.personalInfo.dob
                  }
                }
              }
            },
            { session }
          );
          
          await session.commitTransaction();
          console.log(`✅ Birthday bonus added for user: ${user.displayName} (${user.role})`);
        } catch (err) {
          await session.abortTransaction();
          throw err;
        } finally {
          await session.endSession();
        }
        
        // 3. Send in-app notification
        const notificationPromises = [];
        
        // In-app notification
        notificationPromises.push(
          NotificationService.createNotification({
            recipient: user._id,
            type: 'birthday_greeting',
            title: 'Happy Birthday! 🎂',
            message: `MarketSpase wishes you a fantastic birthday! We've added ₦50 bonus to your ${user.role} wallet.`,
            data: {
              bonusAmount: 50,
              birthdayDate: user.personalInfo.dob,
              userRole: user.role
            },
            priority: 'high',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expire in 7 days
          }).then(() => {
            console.log(`📱 In-app notification sent to ${user.displayName}`);
          }).catch(err => {
            console.error(`Failed to send in-app notification to ${user.displayName}:`, err);
          })
        );
        
        // 4. Send email if user has email and allows it
        if (user.email) {
          //const emailTemplate = userBirthdayEmailTemplate(user);
          
        //   notificationPromises.push(
        //     sendEmail({
        //       to: user.email,
        //       subject: `🎉 Happy Birthday from MarketSpase!`,
        //       html: emailTemplate,
        //       category: 'birthday',
        //       metadata: {
        //         userId: user._id.toString(),
        //         userRole: user.role,
        //         bonusAmount: 50,
        //         birthdayDate: user.personalInfo.dob
        //       }
        //     }).then(() => {
        //       emailsSent++;
        //       console.log(`📧 Birthday email sent to ${user.email}`);
        //     }).catch(err => {
        //       console.error(`Failed to send email to ${user.email}:`, err);
        //     })
        //   );

        //Send email to form owner
        //const ownerSubject = `🎉 Happy Birthday from MarketSpase!`,
        //const ownerMessage = adminWelcomeEmailTemplate(user);
        //const ownerEmails = ['schooltraz@gmail.com'];
        //await Promise.all(ownerEmails.map(email => sendEmail(email, ownerSubject, ownerMessage)));

        //Send welcome email to the user
        const userSubject = `🎉 Happy Birthday from MarketSpase!`;
        const userMessage = userBirthdayEmailTemplate(user);
        await sendEmail(user.email, userSubject, userMessage);

        // user activity log
        //await user.logActivity('login', `You signed up a new account account`, {});
        console.log(`User ${user.email} has been sent a birthday message`);
        }
        
        // // 5. Send push notification if user has device tokens
        // if (isPromoter || isMarketer) {
        //   // This would integrate with your push notification service
        //   // Example structure:
        //   /*
        //   notificationPromises.push(
        //     PushNotificationService.send({
        //       userId: user._id,
        //       title: 'Happy Birthday! 🎂',
        //       body: `MarketSpase wishes you a fantastic birthday! Check your wallet for a special gift.`,
        //       data: { type: 'birthday', bonusAmount: '50' },
        //       priority: 'high'
        //     })
        //   );
        //   */
        // }
        
        // Wait for all notifications to be sent
        await Promise.allSettled(notificationPromises);
        notificationsSent++;
        
      } catch (err) {
        failed++;
        console.error(`❌ Failed to process birthday for user ${user._id}:`, err);
      }
    }
    
    // 6. Send admin summary if there were birthdays
    // if (birthdayUsers.length > 0) {
    //   try {
    //     await NotificationService.createNotification({
    //       recipient: 'admin', // Or find admin users
    //       type: 'system_report',
    //       title: '🎂 Daily Birthday Report',
    //       message: `Processed ${birthdayUsers.length} birthdays today. Sent ${notificationsSent} notifications and ${emailsSent} emails.`,
    //       data: {
    //         totalBirthdays: birthdayUsers.length,
    //         notificationsSent,
    //         emailsSent,
    //         failed,
    //         date: today.toISOString().split('T')[0]
    //       },
    //       priority: 'low'
    //     });
        
    //     console.log(`📊 Admin report sent: ${birthdayUsers.length} birthdays processed`);
    //   } catch (err) {
    //     console.error('Failed to send admin report:', err);
    //   }
    // }
    
    const endTime = new Date();
    const duration = (endTime - jobStartTime) / 1000;
    
    console.log(`🎉 Birthday service completed in ${duration}s`);
    console.log(`📈 Summary: ${notificationsSent} processed, ${emailsSent} emails, ${failed} failed`);
    
    return {
      success: true,
      totalBirthdays: birthdayUsers.length,
      notificationsSent,
      emailsSent,
      failed,
      duration
    };
    
  } catch (err) {
    console.error('❌ Birthday service failed:', err);
    return {
      success: false,
      error: err.message,
      timestamp: new Date()
    };
  }
};