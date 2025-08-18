export const userWelcomeEmailTemplate = (user) => {
  const year = new Date().getFullYear();
  const formattedName = user.name
    ? user.name.charAt(0).toUpperCase() + user.name.slice(1).toLowerCase()
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to DavidoTV</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    
    <div style="background:#8f0045;padding:30px 20px;text-align:center;">
      <img src="https://davidotv.com/img/logo2.PNG" alt="DavidoTV Logo" style="height:36px;">
    </div>
    
    <div style="padding:30px 20px;">
      <h1 style="font-size:24px;font-weight:bold;color:#8f0045;margin:0 0 20px;">Welcome to DavidoTV, ${formattedName}!</h1>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">We're thrilled to welcome you to the ultimate destination for all things Davido. Get ready to dive into exclusive content, connect with fellow fans, and experience music like never before.</p>
      
      <h2 style="font-size:18px;font-weight:600;color:#1a202c;margin:30px 0 16px;">Your DavidoTV experience includes:</h2>

      <ul style="padding-left:0;list-style:none;margin:0 0 30px;">
        <li style="margin-bottom:12px;"><strong>🎵 Exclusive releases:</strong> Be the first to access new music videos and performances</li>
        <li style="margin-bottom:12px;"><strong>🎬 Behind-the-scenes:</strong> Never-before-seen footage and studio sessions</li>
        <li style="margin-bottom:12px;"><strong>🔥 Real-time updates:</strong> Stay informed with the latest news and announcements</li>
        <li style="margin-bottom:12px;"><strong>💬 Vibrant community:</strong> Connect with fans worldwide in our exclusive forums</li>
        <li style="margin-bottom:12px;"><strong>🎤 Live experiences:</strong> Special access to virtual concerts and fan events</li>
      </ul>

      <p style="font-size:16px;line-height:1.6;margin-bottom:24px;">Complete your profile to unlock personalized recommendations tailored just for you.</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="https://davidotv.com/" style="display:inline-block;padding:14px 28px;background:#c2185b;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Start Your Journey</a>
      </div>

      <p style="font-size:15px;line-height:1.6;">Need help? Visit our <a href="https://davidotv.com/faq" style="color:#8f0045;font-weight:600;text-decoration:none;">FAQ</a> or email <a href="mailto:contact@davidotv.com" style="color:#8f0045;text-decoration:none;">contact@davidotv.com</a></p>

      <p style="font-size:15px;margin-top:30px;">See you inside!<br><strong>The DavidoTV Team</strong></p>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <p style="margin:0 0 12px;">© ${year} DavidoTV. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;">"Built by fans, for fans — celebrating the music and legacy of Davido"</p>
      <p style="font-size:12px;margin-top:20px;color:#718096;">
        You're receiving this email because you signed up for DavidoTV.<br>
        <a href="#" style="color:#a0aec0;text-decoration:none;">Unsubscribe</a> | 
        <a href="#" style="color:#a0aec0;text-decoration:none;">Manage Preferences</a> | 
        <a href="#" style="color:#a0aec0;text-decoration:none;">Privacy Policy</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
};
