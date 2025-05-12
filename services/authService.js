const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthService {
  async verifyGoogleToken(token) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      return ticket.getPayload();
    } catch (error) {
      throw new Error('Invalid Google token');
    }
  }

  async findOrCreateUser(googleUser) {
    try {
      let user = await User.findOne({ email: googleUser.email });
      
      if (!user) {
        user = new User({
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          googleId: googleUser.sub
        });
        await user.save();
      }
      
      return user;
    } catch (error) {
      throw new Error('Error creating/finding user');
    }
  }

  generateToken(user) {
    return jwt.sign(
      { 
        id: user._id,
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

module.exports = new AuthService(); 