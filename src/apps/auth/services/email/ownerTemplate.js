export const ownerEmailTemplate = (user) => {
  const year = new Date().getFullYear();
  const formattedName = user.name
    ? user.name.charAt(0).toUpperCase() + user.name.slice(1).toLowerCase()
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New User Signup Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;line-height:1.5;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    
    <div style="background:#8f0045;padding:25px 20px;text-align:center;">
      <img src="https://davidotv.com/img/logo2.PNG" alt="DavidoTV Logo" style="height:32px;">
    </div>
    
    <div style="padding:30px 20px;">
      <h1 style="font-size:22px;font-weight:bold;color:#8f0045;margin:0 0 20px;">New User Signup Notification</h1>
      
      <div style="display:inline-block;background:#fff0f3;color:#8f0045;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;margin-bottom:20px;border:1px solid rgba(143, 0, 69, 0.2);">ACTION REQUIRED</div>
      
      <p style="font-size:16px;margin:20px 0;">A new user has signed up for DavidoTV. Here are the details:</p>
      
      <div style="background:#fff5f8;border-left:4px solid #8f0045;border-radius:8px;padding:20px;margin-bottom:25px;">
        <h3 style="margin:0 0 16px;color:#8f0045;font-size:18px;">User Information</h3>
        
        <div style="margin-bottom:12px;">
          <strong style="display:inline-block;min-width:100px;color:#4a5568;">Name:</strong>
          <span style="font-weight:500;color:#1a202c;">${formattedName}</span>
        </div>
        
        <div style="margin-bottom:12px;">
          <strong style="display:inline-block;min-width:100px;color:#4a5568;">Email:</strong>
          <span style="font-weight:500;color:#1a202c;">${user.email || 'Not provided'}</span>
        </div>
        
        <div style="margin-bottom:12px;">
          <strong style="display:inline-block;min-width:100px;color:#4a5568;">Signup Date:</strong>
          <span style="font-weight:500;color:#1a202c;">${new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
      </div>
      
      <p style="font-weight:500;font-size:15px;">This user has been automatically added to our system. You may want to review their profile or send a welcome communication.</p>
      
      <div style="text-align:center;margin:30px 0;">
        <a href="https://admin.davidotv.com" style="display:inline-block;padding:14px 28px;background:#c2185b;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;">View User in Admin Dashboard</a>
      </div>

      <p style="font-size:14px;color:#718096;">
        <strong>Note:</strong> This is an automated notification. No action is required unless you wish to engage with this new user.
      </p>
    </div>
    
    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <div style="height:1px;background:rgba(255,255,255,0.1);margin:20px 0;"></div>
      
      <p style="margin:0 0 10px;">© ${year} DavidoTV Admin. All rights reserved.</p>
      <p style="color:#cbd5e0;font-style:italic;margin:0 0 20px;">"The premier fan destination for all things Davido"</p>
      
      <p style="font-size:12px;color:#718096;">
        You're receiving this email because you're an administrator of DavidoTV.<br>
        <a href="https://admin.davidotv.com/notifications" style="color:#a0aec0;text-decoration:none;">Manage Notifications</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
};
