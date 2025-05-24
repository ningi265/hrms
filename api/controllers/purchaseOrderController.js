const PurchaseOrder = require("../../models/purchaseOrder");
const RFQ = require("../../models/RFQ");
const { notifyVendorPOCreated, notifyPOApproval, notifyPOShipped, notifyPODelivered, notifyPOConfirmed } = require("../services/notificationService");

exports.createPO = async (req, res) => {
    try {
      console.log("Create PO Request Body:", req.body); // Log the request payload
      const { rfqId, items } = req.body;
  
      const rfq = await RFQ.findById(rfqId).populate("selectedVendor");
      console.log("RFQ Found:", rfq); // Log the RFQ
  
      if (!rfq) return res.status(404).json({ message: "RFQ not found" });
      if (rfq.status !== "closed") return res.status(400).json({ message: "RFQ must be closed to generate a PO" });
  
      // Calculate total amount
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      console.log("Calculated Total Amount:", totalAmount); // Log the total amount
  
      // Create the purchase order
      const po = await PurchaseOrder.create({
        rfq: rfq._id,
        vendor: rfq.selectedVendor,
        procurementOfficer: req.user._id,
        items,
        totalAmount,
      });
      console.log("Purchase Order Created:", po); // Log the created PO
  
      // Notify the vendor
      await notifyVendorPOCreated(rfq.selectedVendor, po);
  
      res.status(201).json({ message: "Purchase Order created successfully", po });
    } catch (err) {
      console.error("Error in createPO:", err); // Log the error
      res.status(500).json({ message: "Server error", error: err.message });
    }
  };

// Approve a PO (Admin Only)
exports.approvePO = async (req, res) => {
    try {
        console.log("Approve PO Request Params:", req.params); // Log the request params
        const po = await PurchaseOrder.findById(req.params.id);
        console.log("Purchase Order Found for Approval:", po); // Log the PO

        if (!po) return res.status(404).json({ message: "Purchase Order not found" });

        po.status = "approved";
        po.approver = req.user.id;
        await po.save();
        console.log("Purchase Order Approved:", po); // Log the updated PO

        // Notify procurement officer and vendor
        await notifyPOApproval(po.procurementOfficer, po.vendor, po);

        res.json({ message: "Purchase Order approved", po });
    } catch (err) {
        console.error("Error in approvePO:", err); // Log the error
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Reject a PO (Admin Only)
exports.rejectPO = async (req, res) => {
    try {
        console.log("Reject PO Request Params:", req.params); // Log the request params
        const po = await PurchaseOrder.findById(req.params.id);
        console.log("Purchase Order Found for Rejection:", po); // Log the PO

        if (!po) return res.status(404).json({ message: "Purchase Order not found" });

        po.status = "rejected";
        po.approver = req.user.id;
        await po.save();
        console.log("Purchase Order Rejected:", po); // Log the updated PO

        res.json({ message: "Purchase Order rejected", po });
    } catch (err) {
        console.error("Error in rejectPO:", err); // Log the error
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get All POs (Admin & Procurement Officers)
exports.getAllPOs = async (req, res) => {
    try {
        console.log("Fetching All Purchase Orders"); // Log the action
        const pos = await PurchaseOrder.find().populate("vendor procurementOfficer approver", "name email");
        console.log("All Purchase Orders:", pos); // Log the fetched POs

        res.json(pos);
    } catch (err) {
        console.error("Error in getAllPOs:", err); // Log the error
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get a Single PO
exports.getPOById = async (req, res) => {
    try {
      const { id } = req.params; // Extract the PO ID from the request parameters
  
      // Validate the ID
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid PO ID" });
      }
  
      // Find the PO by ID
      const po = await PurchaseOrder.findById(id)
        .populate("vendor")
        .populate("procurementOfficer")
        .populate("rfq");
  
      if (!po) {
        return res.status(404).json({ message: "Purchase Order not found" });
      }
  
      res.status(200).json(po);
    } catch (err) {
      console.error("Error in getPOById:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  };



// Get purchase order stats (total, pending, approved, rejected, shipped, delivered, confirmed)
exports.getPOStats = async (req, res) => {
  try {
      console.log("Fetching Purchase Order Stats");
      
      // Count operations
      const [total, pending, approved, rejected, shipped, delivered, confirmed] = await Promise.all([
          PurchaseOrder.countDocuments(),
          PurchaseOrder.countDocuments({ status: "pending" }),
          PurchaseOrder.countDocuments({ status: "approved" }),
          PurchaseOrder.countDocuments({ status: "rejected" }),
          PurchaseOrder.countDocuments({ deliveryStatus: "shipped" }),
          PurchaseOrder.countDocuments({ deliveryStatus: "delivered" }),
          PurchaseOrder.countDocuments({ deliveryStatus: "confirmed" })
      ]);

      // Get actual pending POs with relevant data
      const pendingPOs = await PurchaseOrder.find({ status: "pending" })
          .populate('vendor', 'name email')  // Adjust according to your schema
          .populate('rfq', 'requisitionNumber')  // Example additional population
          .select('poNumber amount createdAt dueDate')  // Only include essential fields
          .sort({ createdAt: -1 })  // Newest first
          .limit(10);  // Limit results

      const stats = {
          counts: {
              total,
              pending,
              approved,
              rejected,
              shipped,
              delivered,
              confirmed
          },
          pendingPOs: pendingPOs  // Include the actual pending purchase orders
      };

      console.log("Successfully fetched PO stats");
      res.json(stats);

  } catch (err) {
      console.error("Error in getPOStats:", {
          message: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString()
      });
      res.status(500).json({ 
          message: "Failed to fetch purchase order statistics",
          error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
      });
  }
};

// Vendor confirms receipt and acceptance of a PO
exports.confirmPO = async (req, res) => {
  try {
      console.log("🔹 Confirm PO endpoint hit!");

      // Log request parameters and body
      console.log("➡️ Request Params:", req.params);
      console.log("➡️ Request Body:", req.body);

      const { id: poId } = req.params; // Correctly extracting poId

      const { vendorId } = req.body; // Vendor ID from the request body

      // Validate request data
      if (!poId || !vendorId) {
          console.log("❌ Missing required data: poId or vendorId");
          return res.status(400).json({ message: "Missing required data: poId or vendorId" });
      }

      // Find the Purchase Order
      const po = await PurchaseOrder.findById(poId);
      if (!po) {
          console.log(`❌ Purchase Order not found with ID: ${poId}`);
          return res.status(404).json({ message: "Purchase Order not found" });
      }

      console.log("✅ Found PO:", po);

      // Check if the vendor is authorized to confirm this PO
      if (po.vendor.toString() !== vendorId) {
          console.log(`⛔ Unauthorized: PO Vendor (${po.vendor.toString()}) does not match Request Vendor (${vendorId})`);
          return res.status(403).json({ message: "Unauthorized: This PO does not belong to the vendor" });
      }

      // Update the PO with vendor confirmation
      po.vendorConfirmation.confirmed = true;
      po.vendorConfirmation.confirmedAt = new Date();
      po.status = "approved"; // Update PO status to "confirmed"

      await po.save();

      console.log("✅ PO confirmed successfully:", po);

      res.status(200).json({ message: "Purchase Order confirmed successfully", po });
  } catch (err) {
      console.error("❌ Error confirming PO:", err);
      res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Vendor updates order status (e.g., "Processing", "Shipped")
exports.updateDeliveryStatus = async (req, res) => {
    try {
        console.log("🔹 Update Delivery Status endpoint hit!");

        // Log request parameters and body
        console.log("➡️ Request Params:", req.params);
        console.log("➡️ Request Body:", req.body);

        const { deliveryStatus, trackingNumber, carrier, token } = req.body;
        const { id: poId } = req.params;

        console.log("🔹 Extracted Data:");
        console.log("   - PO ID:", poId);
        console.log("   - Delivery Status:", deliveryStatus);
        console.log("   - Tracking Number:", trackingNumber);
        console.log("   - Carrier:", carrier);
        console.log("   - Token:", token);

        // Validate the delivery status
        if (!["shipped", "delivered"].includes(deliveryStatus)) {
            console.log("❌ Invalid delivery status:", deliveryStatus);
            return res.status(400).json({ message: "Invalid delivery status" });
        }

        console.log("🔹 Valid delivery status:", deliveryStatus);

        // Check if token exists
        if (!token) {
            console.log("❌ Token is missing in the request body");
            return res.status(400).json({ message: "Token is required" });
        }

        console.log("🔹 Fetching vendor ID from: https://hrms-6s3i.onrender.com/api/vendors/me");
        console.log("🔹 Using token:", token);

        // Step 1: Fetch the vendor ID using the user ID
        const vendorResponse = await fetch("https://hrms-6s3i.onrender.com/api/vendors/me", {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        if (!vendorResponse.ok) {
            console.log("❌ Failed to fetch vendor ID");
            return res.status(404).json({ message: "Vendor not found" });
        }

        const vendorData = await vendorResponse.json();
        const vendorId = vendorData._id;
        console.log("✅ Fetched Vendor ID:", vendorId);

        // Step 2: Find the purchase order
        console.log("🔹 Searching for Purchase Order with ID:", poId);
        const po = await PurchaseOrder.findById(poId);
        if (!po) {
            console.log("❌ Purchase Order not found with ID:", poId);
            return res.status(404).json({ message: "Purchase Order not found" });
        }

        console.log("✅ Found Purchase Order:", po);

        // Step 3: Check if the vendor is authorized to update this PO
        console.log("🔹 Checking vendor authorization...");
        console.log("   - PO Vendor ID:", po.vendor.toString());
        console.log("   - Fetched Vendor ID:", vendorId);

        if (po.vendor.toString() !== vendorId) {
            console.log("❌ Unauthorized: Vendor ID mismatch");
            return res.status(403).json({ message: "Unauthorized" });
        }

        console.log("✅ Vendor is authorized to update this PO");

        // Step 4: Update the delivery status and tracking information
        console.log("🔹 Updating delivery status and tracking information...");
        po.deliveryStatus = deliveryStatus;
        if (deliveryStatus === "shipped") {
            po.trackingNumber = trackingNumber;
            po.carrier = carrier;
        }

        console.log("🔹 Updated PO Data:", {
            deliveryStatus: po.deliveryStatus,
            trackingNumber: po.trackingNumber,
            carrier: po.carrier,
        });

        await po.save();
        console.log("✅ Purchase Order saved successfully");

        // Step 5: Notify the buyer
        if (deliveryStatus === "shipped") {
            console.log("🔹 Notifying buyer about shipment...");
            await notifyPOShipped(po.procurementOfficer, po);
        } else if (deliveryStatus === "delivered") {
            console.log("🔹 Notifying buyer about delivery...");
            await notifyPODelivered(po.procurementOfficer, po);
        }

        console.log("✅ Notifications sent successfully");

        res.status(200).json({
            message: `Delivery status updated to ${deliveryStatus}`,
            po,
        });
    } catch (err) {
        console.error("❌ Error in updateDeliveryStatus:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


  exports.confirmDelivery = async (req, res) => {
    try {
      console.log("Confirm Delivery Request Body:", req.body); // Log the request payload
      console.log("Confirm Delivery Request Params:", req.params); // Log the request params
  
      const { proofOfDelivery, receivedBy } = req.body;
      const { id: poId } = req.params;
  
      // Find the purchase order
      const po = await PurchaseOrder.findById(poId);
      if (!po) {
        return res.status(404).json({ message: "Purchase Order not found" });
      }
  
      // Check if the buyer is authorized to confirm delivery
      if (po.procurementOfficer.toString() !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
  
      // Check if the order is already delivered
      if (po.deliveryStatus !== "delivered") {
        return res.status(400).json({ message: "Order must be delivered before confirming" });
      }
  
      // Update the delivery status and delivery confirmation details
      po.deliveryStatus = "confirmed";
      po.proofOfDelivery = proofOfDelivery;
      po.receivedBy = receivedBy;
      await po.save();
  
      console.log("Purchase Order Delivery Confirmed:", po); // Log the updated PO
  
      // Notify the vendor
      await notifyPOConfirmed(po.vendor, po);
  
      res.status(200).json({
        message: "Delivery confirmed successfully",
        po,
      });
    } catch (err) {
      console.error("Error in confirmDelivery:", err); // Log the error
      res.status(500).json({ message: "Server error", error: err.message });
    }
  };
