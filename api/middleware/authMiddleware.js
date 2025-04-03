const jwt = require('jsonwebtoken');

exports.protect = (roles = []) => (req, res, next) => {
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

    // 4. Attach user to request
    req.user = {
      _id: userId,
      role: decoded.role || 'user' // Default role if not specified
    };

    // 5. Check roles if specified
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