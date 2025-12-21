const jwt = require('jsonwebtoken');
const User = require('../../models/user'); 

exports.protect = (roles = []) => async (req, res, next) => {
  try {
    // 1. Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized: No token provided" 
      });
    }

    const token = authHeader.split(' ')[1];
    
    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. More flexible token structure check
    const userId = decoded._id || decoded.id || decoded.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token: Missing user identifier" 
      });
    }

    // 4. Fetch user from database WITH company
    const user = await User.findById(userId)
      .select('-password')
      .populate('company', '_id name'); // Populate company

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // 5. Attach user to request WITH company
    req.user = {
      _id: user._id,
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role || decoded.role || 'user',
      company: user.company?._id, // Get company from populated user
      companyName: user.company?.name
    };

    // 6. Check roles if specified
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: "Forbidden: Insufficient permissions" 
      });
    }

    next();
  } catch (err) {
    console.error("Authentication Error:", err);
    const message = err.name === 'JsonWebTokenError' ? 'Invalid token' : 
                   err.name === 'TokenExpiredError' ? 'Token expired' : 
                   'Authentication failed';
    res.status(401).json({ 
      success: false,
      message,
      error: err.message 
    });
  }
};