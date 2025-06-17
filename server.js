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

// Import new fleet management routes
//const fleetRoutes = require("./routes/fleetRoutes");
//const fleetNotificationRoutes = require("./routes/fleetNotificationRoutes");

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

// New fleet management routes
//app.use("/api/fleet", fleetRoutes);
//app.use("/api/fleet-notifications", fleetNotificationRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle driver location updates from mobile apps
  socket.on('driver-location', (data) => {
    const { driverId, latitude, longitude, accuracy } = data;
    
    // Broadcast to all connected clients except sender
    socket.broadcast.emit('driver-location-update', {
      driverId,
      location: { latitude, longitude },
      accuracy,
      timestamp: new Date()
    });
  });

  // Handle driver status changes
  socket.on('driver-status-change', (data) => {
    const { driverId, status, driverName } = data;
    
    socket.broadcast.emit('driver-status-update', {
      driverId,
      status,
      driverName,
      timestamp: new Date()
    });
  });

  // Handle trip updates
  socket.on('trip-update', (data) => {
    socket.broadcast.emit('trip-status-update', data);
  });

  // Handle emergency alerts
  socket.on('emergency-alert', (data) => {
    io.emit('emergency-notification', {
      ...data,
      priority: 'urgent',
      timestamp: new Date()
    });
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

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Auto-generate fleet notifications (but not simulate driver locations - use real data)
function startAutoNotifications() {
  // Import the notification generators
  const { generateFleetNotifications } = require('./utils/notificationGenerator');
  
  // Start auto-notifications only (no driver simulation)
  generateFleetNotifications(io);
  
  console.log('Fleet notification system started - using real driver data');
}

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

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is ready on port ${PORT}`);
});

// Export for testing purposes
module.exports = { app, server, io };