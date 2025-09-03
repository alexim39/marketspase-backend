export const ownerEmailTemplate = (userBooking) => {  
  // Create a new date object from the consultDate and add one day to it  
  const bookingDate = new Date(userBooking.consultDate);  
  bookingDate.setDate(bookingDate.getDate() + 1); // Add one day  

  // Format the date to a user-friendly format  
  const formattedDate = bookingDate.toLocaleDateString('en-US', {  
    year: 'numeric',  
    month: 'long',  
    day: 'numeric'  
  });  

  const year = new Date().getFullYear();
  const formattedName = userBooking.name ? userBooking.name.charAt(0).toUpperCase() + userBooking.name.slice(1).toLowerCase()  : '';


  return `  
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">  
      <header style="text-align: center; padding: 10px; background-color: #f4f4f4;">  
        <span style="font-family: sans-serif; font-size: 20px; font-weight: bold; color: #050111;">
          <img src="https://marketspase.com/img/logo.png" alt="MarketSpase Logo" style="height: 50px;" />
        </span>
      </header>  
      <main style="padding: 20px;">  
        
        <p>A user named ${formattedName}</strong> with phone number ${userBooking.phone}</strong> has booked for a one-on-one session.</p>  
        <p>You will need to be available at the scheduled date and time</p>  

        <h3>Booking Details</h3>  

        <ul>  
          <li><strong>Date: </strong> ${formattedDate}</li>  
          <li><strong>Time: </strong> ${userBooking.consultTime}</li>  
          <li><strong>Platform: </strong> ${userBooking.contactMethod}</li>  
        </ul>  

        <br>  
        <div style="text-align: center;">  
          <a href="https://admin.marketspase.com/" style="padding: 10px 20px; background-color: #050111; color: white; text-decoration: none; border-radius: 5px; text-align: center; margin: 1em 0;">Go to Admin Platform</a>  
        </div>  
      </main>  
      <br>
      <footer style="text-align: center; padding: 20px; background-color: #f4f4f4; ; margin-top: 20px;">

        <p>© ${year} MarketSpase. All rights reserved.</p>
        <div>
          Your online business space for passive income
        </div>

      </footer>
    </div>  
  `;  
};