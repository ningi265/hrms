const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize the app
const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  }
});

// Import Location Service for live tracking
const LocationService = require('./api/services/locationService'); // You'll need to create this

// Initialize location service
let locationService = null;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(bodyParser.json()); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Connect to MongoDB
const uri = process.env.MONGO_URI || "mongodb+srv://brianmtonga592:TXrlxC13moNMMIOh@lostandfound1.f6vrf.mongodb.net/?retryWrites=true&w=majority&appName=lostandfound1"
mongoose.connect(uri)
  .then(() => {
    console.log("Connected to MongoDB");
    
    // Initialize location service after DB connection
    locationService = new LocationService(io);
    
    // Start automatic location tracking (every 2 minutes)
    locationService.start(2);
    console.log('Live location tracking service started');
    
    // Start auto-generating notifications after DB connection
    startAutoNotifications();
  })
  .catch((error) => console.error("Error connecting to MongoDB:", error.message));

const conn = mongoose.connection;

// Import existing routes
const authRoutes = require("./routes/authRoutes");
const requisitionRoutes = require("./routes/requisitionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const rfqRoutes = require("./routes/rfqRoutes");
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const invoiceRoutes = require("./routes/invoiceRoutes");
const travelRequestRoutes = require("./routes/travel");
const departmentsRoutes = require("./routes/departmentRoutes");
const driverRoutes = require("./routes/driverRoutes");
const invitationRoutes = require("./routes/invitationRoutes");

// Existing routes
app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/requisitions", requisitionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/rfqs", rfqRoutes); 
app.use('/api/purchase-orders', purchaseOrderRoutes); 
app.use("/api/travel-requests", travelRequestRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/invitations", invitationRoutes);

// ===== NEW LOCATION SERVICE CONTROL ENDPOINTS =====

// Get location service status
app.get('/api/location-service/status', (req, res) => {
  if (!locationService) {
    return res.status(503).json({
      success: false,
      message: 'Location service not initialized'
    });
  }

  const status = locationService.getStatus();
  res.json({
    success: true,
    data: status
  });
});

// Start location service
app.post('/api/location-service/start', (req, res) => {
  if (!locationService) {
    return res.status(503).json({
      success: false,
      message: 'Location service not initialized'
    });
  }

  const { intervalMinutes = 2 } = req.body;
  
  try {
    locationService.start(intervalMinutes);
    res.json({
      success: true,
      message: `Location service started with ${intervalMinutes} minute intervals`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start location service',
      error: error.message
    });
  }
});

// Stop location service
app.post('/api/location-service/stop', (req, res) => {
  if (!locationService) {
    return res.status(503).json({
      success: false,
      message: 'Location service not initialized'
    });
  }

  try {
    locationService.stop();
    res.json({
      success: true,
      message: 'Location service stopped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stop location service',
      error: error.message
    });
  }
});

// Manually trigger location update for all drivers
app.post('/api/location-service/trigger-update', async (req, res) => {
  if (!locationService) {
    return res.status(503).json({
      success: false,
      message: 'Location service not initialized'
    });
  }

  try {
    const result = await locationService.triggerUpdate();
    res.json({
      success: true,
      message: 'Location update triggered successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to trigger location update',
      error: error.message
    });
  }
});

// Update location for specific driver
app.post('/api/location-service/update-driver/:driverId', async (req, res) => {
  if (!locationService) {
    return res.status(503).json({
      success: false,
      message: 'Location service not initialized'
    });
  }

  const { driverId } = req.params;

  try {
    const result = await locationService.updateDriverLocation(driverId);
    res.json({
      success: true,
      message: `Location updated for driver ${driverId}`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to update location for driver ${driverId}`,
      error: error.message
    });
  }
});



// Enhanced Socket.IO connection handling for live location tracking
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // ===== ENHANCED LOCATION TRACKING EVENTS =====

  // Handle client requesting current location data
  socket.on('request-current-locations', async () => {
    try {
      const User = require('./models/user');
      const drivers = await User.find({
        role: 'Driver',
        'location.lastKnownLocation.latitude': { $exists: true }
      }).select(['firstName', 'lastName', 'employeeId', 'location', 'status', 'lastLoginAt']);

      const locationData = drivers.map(driver => {
        const lastKnownLocation = driver.location?.lastKnownLocation || {};
        return {
          driverId: driver.employeeId,
          driverName: `${driver.firstName} ${driver.lastName}`,
          latitude: lastKnownLocation.latitude,
          longitude: lastKnownLocation.longitude,
          accuracy: lastKnownLocation.accuracy,
          speed: lastKnownLocation.speed,
          heading: lastKnownLocation.heading,
          batteryLevel: lastKnownLocation.batteryLevel,
          timestamp: lastKnownLocation.timestamp,
          source: lastKnownLocation.source,
          status: driver.status,
          isOnline: isDriverOnline(driver.lastLoginAt)
        };
      });

      socket.emit('current-locations', {
        success: true,
        data: locationData,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('current-locations', {
        success: false,
        error: error.message
      });
    }
  });

  // Handle driver location updates from mobile apps or GPS devices
  socket.on('driver-location', (data) => {
    const { driverId, latitude, longitude, accuracy, speed, heading, batteryLevel, source } = data;
    
    // Enhanced location data
    const locationUpdate = {
      driverId,
      location: { latitude, longitude },
      accuracy: accuracy || null,
      speed: speed || null,
      heading: heading || null,
      batteryLevel: batteryLevel || null,
      timestamp: new Date(),
      source: source || 'mobile'
    };
    
    // Broadcast to all connected clients except sender
    socket.broadcast.emit('driver-location-update', locationUpdate);
    
    console.log(`Location update from driver ${driverId}:`, locationUpdate);
  });

  // Handle driver status changes
  socket.on('driver-status-change', (data) => {
    const { driverId, status, driverName } = data;
    
    const statusUpdate = {
      driverId,
      status,
      driverName,
      timestamp: new Date()
    };
    
    socket.broadcast.emit('driver-status-update', statusUpdate);
    console.log(`Status update from driver ${driverId}: ${status}`);
  });

  // Handle client subscribing to specific driver updates
  socket.on('subscribe-driver', (driverId) => {
    socket.join(`driver-${driverId}`);
    console.log(`Client ${socket.id} subscribed to driver ${driverId} updates`);
  });

  // Handle client unsubscribing from driver updates
  socket.on('unsubscribe-driver', (driverId) => {
    socket.leave(`driver-${driverId}`);
    console.log(`Client ${socket.id} unsubscribed from driver ${driverId} updates`);
  });

  // Handle client requesting location service status
  socket.on('request-service-status', () => {
    if (locationService) {
      const status = locationService.getStatus();
      socket.emit('service-status', {
        success: true,
        data: status
      });
    } else {
      socket.emit('service-status', {
        success: false,
        message: 'Location service not initialized'
      });
    }
  });

  // Handle trip updates
  socket.on('trip-update', (data) => {
    socket.broadcast.emit('trip-status-update', data);
  });

  // Handle emergency alerts with enhanced location data
  socket.on('emergency-alert', (data) => {
    const emergencyData = {
      ...data,
      priority: 'urgent',
      timestamp: new Date(),
      id: `emergency-${Date.now()}`
    };
    
    // Emit to all clients immediately
    io.emit('emergency-notification', emergencyData);
    
    console.log('Emergency alert broadcasted:', emergencyData);
  });

  // Handle geofence events
  socket.on('geofence-event', (data) => {
    const { driverId, geofenceName, eventType, location } = data;
    
    const geofenceEvent = {
      driverId,
      geofenceName,
      eventType, // 'enter' or 'exit'
      location,
      timestamp: new Date()
    };
    
    socket.broadcast.emit('geofence-notification', geofenceEvent);
    console.log(`Geofence ${eventType} event for driver ${driverId}:`, geofenceEvent);
  });

  // Handle join room for department-specific updates
  socket.on('join-department', (departmentId) => {
    socket.join(`department-${departmentId}`);
    console.log(`Client ${socket.id} joined department-${departmentId}`);
  });

  // Handle leave room
  socket.on('leave-department', (departmentId) => {
    socket.leave(`department-${departmentId}`);
    console.log(`Client ${socket.id} left department-${departmentId}`);
  });

  // Handle driver going online/offline
  socket.on('driver-online-status', (data) => {
    const { driverId, isOnline, driverName } = data;
    
    const onlineStatusUpdate = {
      driverId,
      isOnline,
      driverName,
      timestamp: new Date()
    };
    
    socket.broadcast.emit('driver-online-status-update', onlineStatusUpdate);
    console.log(`Driver ${driverId} is now ${isOnline ? 'online' : 'offline'}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to check if driver is online
function isDriverOnline(lastLoginAt) {
  if (!lastLoginAt) return false;
  const hoursOffline = (Date.now() - new Date(lastLoginAt)) / (1000 * 60 * 60);
  return hoursOffline < 24; // Consider online if logged in within 24 hours
}

// Auto-generate fleet notifications (enhanced with location service integration)
function startAutoNotifications() {
  // Import the notification generators
  const { generateFleetNotifications } = require('./utils/notificationGenerator');
  
  // Start auto-notifications with location service integration
  generateFleetNotifications(io, locationService);
  
  console.log('Fleet notification system started with live location integration');
}

// ===== ADDITIONAL FLEET MANAGEMENT ENDPOINTS =====

// Get real-time fleet overview
app.get('/api/fleet/overview', async (req, res) => {
  try {
    const User = require('./models/user');
    
    // Get driver counts by status
    const totalDrivers = await User.countDocuments({ role: 'Driver' });
    const activeDrivers = await User.countDocuments({ role: 'Driver', status: 'active' });
    const onlineDrivers = await User.countDocuments({
      role: 'Driver',
      lastLoginAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    // Get drivers with GPS
    const driversWithGPS = await User.countDocuments({
      role: 'Driver',
      'location.lastKnownLocation.timestamp': { 
        $gte: new Date(Date.now() - 30 * 60 * 1000) 
      }
    });
    
    // Get moving drivers
    const movingDrivers = await User.countDocuments({
      role: 'Driver',
      'location.lastKnownLocation.speed': { $gt: 5 },
      'location.lastKnownLocation.timestamp': { 
        $gte: new Date(Date.now() - 10 * 60 * 1000) 
      }
    });

    const fleetOverview = {
      total: totalDrivers,
      active: activeDrivers,
      online: onlineDrivers,
      withGPS: driversWithGPS,
      moving: movingDrivers,
      locationServiceStatus: locationService ? locationService.getStatus() : null,
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      data: fleetOverview
    });
  } catch (error) {
    console.error('Error fetching fleet overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fleet overview',
      error: error.message
    });
  }
});

// Get driver location history
app.get('/api/fleet/driver/:driverId/location-history', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { hours = 24 } = req.query;
    
    const User = require('./models/user');
    const driver = await User.findOne({ 
      $or: [{ employeeId: driverId }, { _id: driverId }] 
    }).select('location firstName lastName employeeId');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    const locationHistory = driver.location?.locationHistory?.filter(
      loc => loc.timestamp >= cutoffTime
    ) || [];

    res.json({
      success: true,
      data: {
        driverId: driver.employeeId,
        driverName: `${driver.firstName} ${driver.lastName}`,
        locationHistory: locationHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
        period: `${hours} hours`
      }
    });
  } catch (error) {
    console.error('Error fetching location history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch location history',
      error: error.message
    });
  }
});

// Emergency endpoints
app.post('/api/fleet/emergency/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { type, message, location } = req.body;
    
    const emergencyAlert = {
      driverId,
      type,
      message,
      location,
      timestamp: new Date(),
      id: `emergency-${Date.now()}`
    };

    // Broadcast emergency alert to all connected clients
    io.emit('emergency-notification', emergencyAlert);

    res.json({
      success: true,
      message: 'Emergency alert broadcasted',
      data: emergencyAlert
    });
  } catch (error) {
    console.error('Error broadcasting emergency alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to broadcast emergency alert',
      error: error.message
    });
  }
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  if (locationService) {
    locationService.stop();
  }
  
  server.close(() => {
    console.log('Server closed');
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  
  if (locationService) {
    locationService.stop();
  }
  
  server.close(() => {
    console.log('Server closed');
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is ready on port ${PORT}`);
  console.log(`Live location tracking is ${locationService ? 'enabled' : 'disabled'}`);
});

// Export for testing purposes
module.exports = { app, server, io };