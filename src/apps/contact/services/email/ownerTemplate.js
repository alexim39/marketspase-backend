export const ownerContactEmailTemplate = (userData) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
    <header style="text-align: center; padding: 10px; background-color: #f4f4f4;">
       <span style="font-family: sans-serif; font-size: 20px; font-weight: bold; color: #8f0045;">
          <img src="https://davidotv.com/img/logo.png" alt="davidotv Logo" style="height: 50px;" />
        </span>
    </header>
    <main style="padding: 20px;">
      <h1>Davidotv Support Request</h1>
      <p>A new user named <strong>${userData.name.toUpperCase()} ${userData.surname.toUpperCase()}</strong>, email <strong>${userData.email}</strong> and request ID <strong>${userData.requestID}</strong> just sent a contact request in DavidoTV</p>
      <p>You will need to follow up with the user via email at once.</p>

      <h3>Message Details</h3>

      <ul>
        <li><strong>Reason: </strong> ${userData.reason}</li>
        <li><strong>Subject: </strong> ${userData.subject}</li>
        <li><strong>Messsage: </strong> ${userData.message}</li>
      </ul>

      <br>
      <div style="text-align: center;">
        <a href="https://admin.davidotv.com/" style="padding: 10px 20px; background-color: #8f0045; color: white; text-decoration: none; border-radius: 5px; text-align: center; margin: 1em 0;">Go to Admin Platform</a>
      </div>
    </main>  
    <br>
  </div>
`;