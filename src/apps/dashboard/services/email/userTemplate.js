export const userNotificationEmailTemplate = (userBooking) => {  
  // Create a new date object from the consultDate and add one day to it  
  const bookingDate = new Date(userBooking.consultDate);  
  bookingDate.setDate(bookingDate.getDate() + 1); // Add one day  

  // Format the date to a user-friendly format  
  const formattedDate = bookingDate.toLocaleDateString('en-US', {  
    year: 'numeric',  
    month: 'long',  
    day: 'numeric'  
  });  

  return `  
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">  
      <header style="text-align: center; padding: 10px; background-color: #f4f4f4;">  
         <span style="font-family: sans-serif; font-size: 20px; font-weight: bold; color: #050111;">
          <img src="https://marketspase.com/img/logo.png" alt="MarketSpase Logo" style="height: 50px;" />
        </span>
      </header>  

      <main style="padding: 20px;">  
        <h2>Your One-on-One Session is Confirmed – Let’s Meet in the space!</h2>  

        <p>Hi <strong>${userBooking.name.toUpperCase()}</strong>,</p>  

        <p>  
          Fantastic news! Your one-on-one session with MarketSpase has been successfully booked.   
          This is your chance to meet with one of our agent and get clearification about our business.  
        </p>  

        <h3>  
          Here are some of the benefits you stand to get on the session:  
        </h3>  

        <ul>  
          <li>Learn how our business works and how you can start generating passive income online.</li>  
          <li>Get personalized guidance tailored to your business goals.</li>  
          <li>Understand the tools available in our platform.</li>  
          <li>Ask personalized questions and get answers directly from our agent.</li>  
        </ul>  

        <h3>  
          Here are your session details:  
        </h3>  

        <ul>  
          <li><strong>Date: </strong> ${formattedDate}</li>  
          <li><strong>Time: </strong> ${userBooking.consultTime}</li>  
          <li><strong>Platform: </strong> ${userBooking.contactMethod}</li>  
        </ul>  

        <p>  
          If you have further questions, please visit our <a href="https://marketspase.com/faq" style="color: #050111;">FAQ page</a> for answers to some questions about our business or reach out to us at contacts@marketspase.com  
        </p>  

        <p>  
          Let's create your digital space together!
        </p>  

        <p>  
          Best regards,  
          <br>  
          Alex Imenwo  
          <br>  
          <strong>MarketSpase Team</strong>  
        </p>  
      </main>   
    </div>  
  `;  
};