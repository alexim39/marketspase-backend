export const userWithdrawalEmailTemplate = (partner, payload) => {  
 
  const year = new Date().getFullYear();
  const formattedName = partner.name ? partner.name.split(' ') // Split the name into an array of words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize the first letter of each word
      .join(' ') // Join the words back into a single string
  : '';

  return `  
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">  
      <header style="text-align: center; padding: 10px; background-color: #f4f4f4;">  
         <span style="font-family: sans-serif; font-size: 20px; font-weight: bold; color: #050111;">
          <img src="https://marketspase.com/img/logo.png" alt="MarketSpase Logo" style="height: 50px;" />
        </span>
      </header>  

      <main style="padding: 20px;">  

        <p>Hi ${formattedName},</p>  

        <p>  
         We are pleased to inform you that your withdrawal request of N${payload.amount} has been successfully processed.
        </p>  

       <p>
       The funds should arrive in your ${payload.bankName} account soon.
       </p>

       <p>
       If you have any questions or concerns, please don't hesitate to contact us.
       </p>

        <p>  
          Thank you for trusting in our business.
        </p>  

        <p>  
          Best regards,  
          <br>  
          Alex Imenwo  
          <br>  
          <strong>MarketSpase Team</strong>  
        </p>  
      </main>   

      <br>
      <footer style="text-align: center; padding: 20px; background-color: #f4f4f4; ; margin-top: 20px;">

        <p>© ${year} MarketSpase. All rights reserved.</p>
        <div>
          Your online business for passive income
        </div>

      </footer>


    </div>  
  `;  
};