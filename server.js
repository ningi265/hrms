const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();


// Initialize the app
const app = express();


// Middleware
app.use(cors());
app.use(bodyParser.json()); // Parse JSON data

// Connect to MongoDB
const uri = process.env.MONGO_URI || "mongodb+srv://brianmtonga592:TXrlxC13moNMMIOh@lostandfound1.f6vrf.mongodb.net/?retryWrites=true&w=majority&appName=lostandfound1"
mongoose.connect(uri)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("Error connecting to MongoDB:", error.message));

const conn = mongoose.connection;

const authRoutes = require("./routes/authRoutes");
const requisitionRoutes = require("./routes/requisitionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const rfqRoutes = require("./routes/rfqRoutes");
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const invoiceRoutes = require("./routes/invoiceRoutes");


// Routes
app.use(express.json());


app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/requisitions", requisitionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/rfqs", rfqRoutes); 
app.use('/api/purchase-orders', purchaseOrderRoutes); 





// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

