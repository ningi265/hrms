// middleware/companyAuth.js
const User = require('../models/user');

module.exports = async (req, res, next) => {
  try {
    // Get user's company
    const user = await User.findById(req.user._id).select('company');
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Attach company to request
    req.company = user.company;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};