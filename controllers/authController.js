const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const User = require('../models/userModel');

const generateToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const createTransporter = async () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_EMAIL,
      pass: process.env.GMAIL_PASSWORD,
    },
  });
};

const sendOTPEmail = async (req, res) => {
  try {
    const { email, name, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }
    const transporter = await createTransporter();
    const mailOptions = {
      from: `"Reals TO Chat" <${process.env.GMAIL_EMAIL}>`,
      to: email,
      subject: 'OTP for your Reals TO Chat authentication',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
          <div style="background: linear-gradient(135deg, #FF0050, #8A2BE2); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Reals TO Chat</h1>
            <p style="margin: 10px 0 0 0;">Create. Connect. Chat.</p>
          </div>
          <div style="background-color: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
            <p>Hello ${name || 'User'},</p>
            <p>Thank you for registering with <strong>Reals TO Chat</strong>! To complete your registration, please use the following One-Time Password (OTP) to verify your email address:</p>
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="margin: 0 0 15px 0; font-size: 16px;">Your OTP is:</p>
              <div style="font-size: 36px; font-weight: bold; color: #FF0050; letter-spacing: 8px; margin: 15px 0;">${otp}</div>
              <p style="margin: 15px 0 0 0; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong> only.</p>
            </div>
            <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Security Tip:</strong> Never share this OTP with anyone. Our team will never ask for your OTP.</p>
            </div>
            <p>If you didn't request this verification, please ignore this email or contact our support team immediately.</p>
            <p>Need help? Contact our support team at <a href="mailto:support@realstochat.com">support@realstochat.com</a></p>
            <p>Thank you,<br>The Reals TO Chat Team</p>
          </div>
          <div style="background-color: 'rgba(255, 255, 255, 0.1)'; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-radius: 0 0 8px 8px;">
            <p style="margin: 0;">© 2023 Reals TO Chat. All rights reserved.</p>
            <p style="margin: 10px 0 0 0;">This email was sent to ${email}. If you believe this was sent in error, please contact us.</p>
          </div>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'OTP email sent successfully' });
  } catch (error) {
    console.error('Nodemailer error:', error);
    res.status(500).json({ message: 'Failed to send OTP email' });
  }
};

const register = async (req, res) => {
  try {
    const { name, phoneNumber, phone, email, password, dateOfBirth, gender, isPhoneVerified, isEmailVerified } = req.body;
    
    const actualPhoneNumber = phoneNumber || phone;
    const emailLower = email.toLowerCase();
    
    console.log(`Registration attempt for email: ${emailLower}, phone: ${actualPhoneNumber}`);
    
    if (!name || !email || !dateOfBirth || !gender) {
      console.log('Missing required fields');
      return res.status(400).json({ success: false, message: 'Name, email, date of birth, and gender are required' });
    }
    
    const existingUserByEmail = await User.findOne({ email: emailLower });
    if (existingUserByEmail) {
      console.log(`Email already in use: ${emailLower}`);
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }
    
    if (actualPhoneNumber) {
      const existingUserByPhone = await User.findOne({ phone: actualPhoneNumber });
      if (existingUserByPhone) {
        console.log(`Phone number already in use: ${actualPhoneNumber}`);
        return res.status(400).json({ success: false, message: 'Phone number already in use' });
      }
    }
    
    let hashedPassword;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }
    
    const newUser = new User({
      name,
      phone: actualPhoneNumber,
      email: emailLower,
      password: hashedPassword,
      dateOfBirth,
      gender,
      isPhoneVerified: isPhoneVerified || false,
      isEmailVerified: isEmailVerified || false,
      registrationComplete: true,
    });
    
    await newUser.save();
    console.log(`User registered successfully: ${emailLower}`);
    
    const token = generateToken(newUser);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        registrationComplete: true
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    
    if (error.code === 11000) {
      let message = 'Registration failed';
      if (error.keyPattern && error.keyPattern.email) {
        message = 'Email already in use';
      } else if (error.keyPattern && error.keyPattern.phone) {
        message = 'Phone number already in use';
      }
      console.log(`Duplicate key error: ${message}`);
      return res.status(400).json({ success: false, message });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const googleSignIn = async (req, res) => {
  try {
    const { name, email, phone, phoneNumber, photoURL, dateOfBirth, gender, idToken } = req.body;
    
    const actualPhoneNumber = phoneNumber || phone;
    const emailLower = email.toLowerCase();
    
    console.log(`Google sign-in attempt for email: ${emailLower}`);
    
    // First, try to find user by email
    let user = await User.findOne({ email: emailLower });
    
    if (user) {
      // Update existing user with Google info
      if (idToken && !user.googleId) {
        user.googleId = idToken; // Store the ID token as googleId
      }
      user.name = name || user.name;
      user.photoURL = photoURL || user.photoURL;
      
      if (actualPhoneNumber) {
        user.phone = actualPhoneNumber;
      }
      
      user.dateOfBirth = dateOfBirth || user.dateOfBirth;
      user.gender = gender || user.gender;
      user.isEmailVerified = true;
      
      await user.save();
      console.log(`Updated Google info for user: ${emailLower}`);
      
      const token = generateToken(user);
      return res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          registrationComplete: user.registrationComplete
        },
      });
    } else {
      // Create new user
      const randomPassword = Math.random().toString(36).slice(2);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      const newUser = new User({
        name,
        email: emailLower,
        phone: actualPhoneNumber,
        password: hashedPassword,
        photoURL,
        dateOfBirth: dateOfBirth || new Date(),
        gender: gender || 'other',
        googleId: idToken || null,
        isEmailVerified: true,
        isPhoneVerified: false,
        registrationComplete: false,
      });
      
      await newUser.save();
      console.log(`New user created via Google sign-in: ${emailLower}`);
      
      const token = generateToken(newUser);
      return res.json({
        success: true,
        token,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          registrationComplete: false
        },
      });
    }
  } catch (error) {
    console.error('Google sign-in error:', error);
    
    if (error.code === 11000) {
      let message = 'Google sign-in failed';
      if (error.keyPattern && error.keyPattern.email) {
        message = 'Email already in use';
      } else if (error.keyPattern && error.keyPattern.phone) {
        message = 'Phone number already in use';
      }
      return res.status(400).json({ success: false, message });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

const verifyPhone = async (req, res) => {
  try {
    const { phoneNumber, phone } = req.body;
    const actualPhoneNumber = phoneNumber || phone;
    
    console.log(`Phone verification attempt for: ${actualPhoneNumber}`);
    
    if (!actualPhoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    
    let user = await User.findOne({ phone: actualPhoneNumber });
    
    if (!user) {
      user = new User({
        phone: actualPhoneNumber,
        isPhoneVerified: true,
        registrationComplete: false,
      });
      await user.save();
      console.log(`New user created for phone: ${actualPhoneNumber}`);
    }
    
    const token = generateToken(user);
    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        registrationComplete: user.registrationComplete
      },
    });
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { phone, phoneNumber, isPhoneVerified, name, dateOfBirth, gender } = req.body;
    const actualPhoneNumber = phoneNumber || phone;
    
    if (!name || !dateOfBirth || !gender) {
      return res.status(400).json({ success: false, message: 'Name, date of birth, and gender are required' });
    }
    
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (actualPhoneNumber) user.phone = actualPhoneNumber;
    if (name) user.name = name;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (gender) user.gender = gender;
    if (isPhoneVerified !== undefined) user.isPhoneVerified = isPhoneVerified;
    
    user.registrationComplete = true;
    await user.save();
    
    const newToken = generateToken(user);
    res.status(200).json({
      success: true,
      token: newToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const googlePhone = async (req, res) => {
  try {
    const { serverAuthCode } = req.body;
    
    if (!serverAuthCode) {
      return res.status(400).json({ success: false, message: 'Server auth code is required' });
    }
    
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth credentials not configured');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: Google OAuth credentials missing',
      });
    }
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'postmessage'
    );
    
    const { tokens } = await oauth2Client.getToken(serverAuthCode);
    oauth2Client.setCredentials(tokens);
    
    const people = google.people({ version: 'v1', auth: oauth2Client });
    const response = await people.people.get({
      resourceName: 'people/me',
      personFields: 'phoneNumbers',
    });
    
    const phoneNumbers = response.data.phoneNumbers;
    let phoneNumber = null;
    
    if (phoneNumbers && phoneNumbers.length > 0) {
      phoneNumber = phoneNumbers[0].value;
    }
    
    res.json({ success: true, phoneNumber });
  } catch (error) {
    console.error('Google phone number fetch error:', error);
    
    if (error.response && error.response.data) {
      console.error('Google API error details:', error.response.data);
    }
    
    if (error.code === 401 && error.response.data.error === 'invalid_client') {
      return res.status(500).json({
        success: false,
        message: 'Google OAuth configuration error. Please check your Google API credentials.',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch phone number from Google',
      error: error.message,
    });
  }
};

const checkUser = async (req, res) => {
  try {
    const { phone, phoneNumber, email } = req.body;
    const actualPhoneNumber = phoneNumber || phone;
    
    console.log(`Check user attempt - email: ${email}, phone: ${actualPhoneNumber}`);
    
    let query = {};
    if (actualPhoneNumber) query.phone = actualPhoneNumber;
    if (email) query.email = email.toLowerCase();
    
    if (!actualPhoneNumber && !email) {
      return res.status(400).json({ success: false, message: 'Phone or email is required' });
    }
    
    const user = await User.findOne(query).select('-password');
    
    if (!user) {
      console.log(`User not found for query:`, query);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log(`User found: ${user.name}, has password: ${!!user.password}`);
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        canLoginWithPassword: user.canLoginWithPassword(),
        registrationComplete: user.registrationComplete
      },
    });
  } catch (error) {
    console.error('Check user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user) {
      res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          isPhoneVerified: user.isPhoneVerified,
          isEmailVerified: user.isEmailVerified,
          registrationComplete: user.registrationComplete,
        },
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log(`Login attempt for email: ${email}`);
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    
    const emailLower = email.toLowerCase();
    
    // Find user with password included
    const user = await User.findOne({ email: emailLower }).select('+password');

    console.log(`User found: ${user.name}, has password: ${!!user.password}`);
    
    // Check if user has a password (Google/phone users might not)
    if (!user.password) {
      console.log(`User ${emailLower} has no password set`);
      return res.status(400).json({ 
        success: false, 
        message: 'This account was created with Google Sign-In or phone verification. Please use the original sign-in method.' 
      });
    }
    

    
    console.log(`Login successful for user: ${emailLower}`);
    
    const token = generateToken(user);
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        registrationComplete: user.registrationComplete
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

const logout = async (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    
    const emailLower = email.toLowerCase();
    const user = await User.findOne({ email: emailLower });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password set successfully'
    });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  sendOTPEmail,
  register,
  googleSignIn,
  verifyPhone,
  updateProfile,
  googlePhone,
  checkGoogleConfig: async (req, res) => {
    try {
      const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
      const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
      
      res.json({
        success: true,
        hasGoogleClientId: hasClientId,
        hasGoogleClientSecret: hasClientSecret,
        clientIdLength: hasClientId ? process.env.GOOGLE_CLIENT_ID.length : 0,
        clientSecretLength: hasClientSecret ? process.env.GOOGLE_CLIENT_SECRET.length : 0,
        clientIdPrefix: hasClientId ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'None',
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  login,
  logout,
  checkUser,
  getUserProfile,
  setPassword
};