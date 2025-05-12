const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const user = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };

    // Create JWT token
    const jwtToken = jwt.sign(user, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    res.json({
      token: jwtToken,
      user
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
});

module.exports = router; 