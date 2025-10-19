export const userGuideTemplate = (userData) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">

    <header style="text-align: center; padding: 10px; background-color: #f4f4f4;">
       <span style="font-family: sans-serif; font-size: 20px; font-weight: bold; color: #050111;">
          <img src="https://marketspase.com/img/logo.png" alt="MarketSpase Logo" style="height: 50px;" />
        </span>
    </header>

    <main style="padding: 20px;">
      <h2>Business Guide Download</h2>

     <p>Kindly note that ${userData.name} ${userData.surname} downloaded the business guide document marketspase website.</p>
      <h3>Message Details</h3>

      <ul>
        <li><strong>Subject: </strong> ${userData.name}</ol>
        <li><strong>Messsage: </strong> ${userData.surname}</li>
        <li><strong>Messsage: </strong> ${userData.email}</li>
      </ul>

    </main>
    <br>
  </div>
`;
