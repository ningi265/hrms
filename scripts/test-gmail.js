require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Testing Gmail connection with your credentials...\n');

const gmailUser = process.env.GMAIL_USER || 'brianmtonga592@gmail.com';
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || 'fmcznqzyywlscpgs';

console.log('Credentials loaded:');
console.log(`GMAIL_USER: ${gmailUser}`);
console.log(`GMAIL_APP_PASSWORD: ${gmailAppPassword ? '✓ Loaded' : '✗ Not found'}\n`);

if (!gmailUser || !gmailAppPassword) {
  console.error('❌ Please set both GMAIL_USER and GMAIL_APP_PASSWORD in your .env file');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailAppPassword
  }
});

console.log('Testing Gmail connection...\n');

// Test 1: Verify credentials
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Gmail verification failed:');
    console.error('Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Make sure 2FA is enabled on your Google account');
    console.error('2. Generate a new App Password at: https://myaccount.google.com/apppasswords');
    console.error('3. Select "Mail" as the app and "Other" as the device');
    console.error('4. Use the 16-character password (not your regular password)');
    console.error('5. Make sure GMAIL_USER is your full email address');
  } else {
    console.log('✅ Gmail connection successful!');
    console.log('Server is ready to send emails');
    
    // Test 2: Send a test email
    console.log('\nSending test email...');
    
    transporter.sendMail({
      from: `"Test" <${gmailUser}>`,
      to: gmailUser,
      subject: 'Gmail Test - NexusMWI',
      text: 'If you receive this, your Gmail setup is working correctly!'
    })
    .then(info => {
      console.log('\n✅ Test email sent successfully!');
      console.log(`Message ID: ${info.messageId}`);
      console.log('Check your email inbox for the test message.');
    })
    .catch(error => {
      console.error('\n❌ Failed to send test email:', error.message);
    });
  }
});