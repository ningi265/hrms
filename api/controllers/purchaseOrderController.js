const PurchaseOrder = require("../../models/purchaseOrder");
const RFQ = require("../../models/RFQ");
const User = require('../../models/user');
const { notifyVendorPOCreated, notifyPOApproval, notifyPOShipped, notifyPODelivered, notifyPOConfirmed } = require("../services/notificationService");


const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.createPO = async (req, res) => {
  try {
    console.log("Create PO Request Body:", req.body);
    const { rfqId, items } = req.body;

    const rfq = await RFQ.findById(rfqId).populate("selectedVendor");
    console.log("RFQ Found:", rfq);

    if (!rfq) return res.status(404).json({ message: "RFQ not found" });
    if (rfq.status !== "closed")
      return res.status(400).json({ message: "RFQ must be closed to generate a PO" });

    // Calculate total amount
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    console.log("Calculated Total Amount:", totalAmount);

    // Get procurement officer (requesting user)
    const procurementOfficer = await User.findById(req.user._id).select("company");
    if (!procurementOfficer) {
      return res.status(404).json({ message: "Procurement officer not found" });
    }

    // Create PO
    const po = await PurchaseOrder.create({
      rfq: rfq._id,
      vendor: rfq.selectedVendor._id,
      procurementOfficer: req.user._id,
      items,
      totalAmount,
      company: procurementOfficer.company, 
      status: "pending",                   
      deliveryStatus: "pending",     
      vendorConfirmation: { confirmed: false } 
    });
    console.log("Purchase Order Created:", po);

    // Prepare email for vendor
    if (!process.env.SENDGRID_API_KEY) {
      console.error("❌ SendGrid API key missing");
      return res.status(500).json({
        message: "Email service not configured properly",
      });
    }

    const msg = {
      to: rfq.selectedVendor.email,
      from: {
        name: "NexusMWI Procurement",
        email: "noreply@nexusmwi.com",
      },
      subject: `Purchase Order Created - PO#${po._id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333;">New Purchase Order Created</h2>
          <p>Hello ${rfq.selectedVendor.firstName || ""} ${rfq.selectedVendor.lastName || ""},</p>
          <p>A new Purchase Order has been created for your company:</p>
          <ul>
            <li><strong>PO ID:</strong> ${po._id}</li>
            <li><strong>RFQ Item:</strong> ${rfq.itemName}</li>
            <li><strong>Quantity:</strong> ${rfq.quantity}</li>
            <li><strong>Total Amount:</strong> $${totalAmount}</li>
          </ul>
          <p>Please log in to the NexusMWI system to view the full details.</p>
        </div>
      `,
      text: `A new Purchase Order has been created.\nPO ID: ${po._id}\nRFQ Item: ${rfq.itemName}\nQuantity: ${rfq.quantity}\nTotal Amount: $${totalAmount}`,
    };

    try {
      const [responseSendGrid] = await sgMail.send(msg);
      console.log("✅ Email sent successfully:", responseSendGrid.statusCode);

      const populatedPO = await PurchaseOrder.findById(po._id)
        .populate({ path: "vendor", select: "firstName lastName email company" })
        .populate({ path: "procurementOfficer", select: "firstName lastName email company" });

      res.status(201).json({
        message: "Purchase Order created successfully",
        po: populatedPO,
        email: {
          status: responseSendGrid.statusCode,
          to: rfq.selectedVendor.email,
        },
      });
    } catch (sendGridError) {
      console.error("❌ SendGrid failed:", sendGridError.message);
      res.status(201).json({
        message: "PO created, but email failed to send",
        po,
        error: sendGridError.message,
      });
    }
  } catch (err) {
    console.error("Error in createPO:", err);
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
    // 1. Get the requesting user
    console.log("Requesting user ID:", req.user._id);
    const requestingUser = await User.findById(req.user._id).select("company isEnterpriseAdmin");
    if (!requestingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Build base query (scope to company unless enterprise admin with allCompanies flag)
    const companyQuery =
      requestingUser.isEnterpriseAdmin && req.query.allCompanies
        ? {}
        : { company: requestingUser.company };
    const baseQuery = { ...companyQuery };

    // 3. Optional filters
    if (req.query.status) {
      baseQuery.status = req.query.status;
    }
    if (req.query.deliveryStatus) {
      baseQuery.deliveryStatus = req.query.deliveryStatus;
    }

    // 4. Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 5. Sorting
    const sortField = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
    const sort = { [sortField]: sortOrder };

    // 6. Fetch POs with population
    const pos = await PurchaseOrder.find(baseQuery)
      .populate({
        path: "vendor",
        select: "firstName lastName email company"
      })
      .populate({
        path: "procurementOfficer",
        select: "firstName lastName email company"
      })
      .populate({
        path: "approver",
        select: "firstName lastName email company"
      })
      .populate({
        path: "rfq",
        select: "status deadline"
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // 7. Total count for pagination
    const totalCount = await PurchaseOrder.countDocuments(baseQuery);

    console.log(`Fetched ${pos.length} POs for company ${requestingUser.company}`);

    // 8. Enhance response (custom derived fields)
    const enhancedPOs = pos.map(po => ({
      ...po,
      itemCount: po.items?.length || 0,
      isVendorConfirmed: po.vendorConfirmation?.confirmed || false,
      vendorConfirmedAt: po.vendorConfirmation?.confirmedAt || null,
      statusColor: getStatusColor(po.status),
      deliveryColor: getDeliveryColor(po.deliveryStatus)
    }));

    // 9. Response
    res.status(200).json({
      success: true,
      data: enhancedPOs,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        sort: `${sortField}:${sortOrder === 1 ? "asc" : "desc"}`,
        context: {
          company: requestingUser.company,
          isEnterpriseAdmin: requestingUser.isEnterpriseAdmin,
          allCompanies: req.query.allCompanies ? true : false
        }
      }
    });
  } catch (error) {
    console.error("Error fetching POs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching POs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

exports.getVendorPOs = async (req, res) => {
  try {
    // 1. Identify vendor (from authenticated user or query param)
    const vendorId = req.user?._id || req.params.vendorId;
    if (!vendorId) {
      return res.status(400).json({ message: "Vendor ID is required" });
    }

    console.log("Fetching POs for vendor:", vendorId);

    // 2. Base query: only POs where this vendor is the selected vendor
    const baseQuery = { vendor: vendorId };

    // 3. Optional filters
    if (req.query.status) {
      baseQuery.status = req.query.status;
    }
    if (req.query.deliveryStatus) {
      baseQuery.deliveryStatus = req.query.deliveryStatus;
    }

    // 4. Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 5. Sorting
    const sortField = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
    const sort = { [sortField]: sortOrder };

    // 6. Fetch vendor POs with populated RFQ
    const pos = await PurchaseOrder.find(baseQuery)
      .populate({
        path: "rfq",
        select: "itemName quantity status deadline selectedVendor",
      })
      .populate({
        path: "procurementOfficer",
        select: "firstName lastName email company",
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // 7. Total count
    const totalCount = await PurchaseOrder.countDocuments(baseQuery);

    console.log(`Fetched ${pos.length} POs for vendor ${vendorId}`);

    // 8. Enhance response
    const enhancedPOs = pos.map((po) => ({
      ...po,
      itemCount: po.items?.length || 0,
      statusColor: getStatusColor(po.status),
      deliveryColor: getDeliveryColor(po.deliveryStatus),
    }));

    // 9. Response
    res.status(200).json({
      success: true,
      data: enhancedPOs,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        sort: `${sortField}:${sortOrder === 1 ? "asc" : "desc"}`,
        context: {
          vendor: vendorId,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching vendor POs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendor POs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// Get a Single PO
exports.getPOById = async (req, res) => {
    try {
      const { id } = req.params; 
  
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
    
    // Get the requesting user's company
    const requestingUser = await User.findById(req.user._id).select('company isEnterpriseAdmin');
    if (!requestingUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Base query - filter by company unless user is enterprise admin with special privileges
    const companyQuery = requestingUser.isEnterpriseAdmin && req.query.allCompanies ? {} : { company: requestingUser.company };

    // Count operations with company filtering
    const [total, pending, approved, rejected, shipped, delivered, confirmed] = await Promise.all([
      PurchaseOrder.countDocuments(companyQuery),
      PurchaseOrder.countDocuments({ ...companyQuery, status: "pending" }),
      PurchaseOrder.countDocuments({ ...companyQuery, status: "approved" }),
      PurchaseOrder.countDocuments({ ...companyQuery, status: "rejected" }),
      PurchaseOrder.countDocuments({ ...companyQuery, deliveryStatus: "shipped" }),
      PurchaseOrder.countDocuments({ ...companyQuery, deliveryStatus: "delivered" }),
      PurchaseOrder.countDocuments({ ...companyQuery, deliveryStatus: "confirmed" })
    ]);

    // Get actual pending POs with relevant data and company filtering
    const pendingPOs = await PurchaseOrder.find({ ...companyQuery, status: "pending" })
      .populate({
        path: 'vendor',
        select: 'name email contactPerson',
        populate: {
          path: 'company',
          select: 'name'
        }
      })
      .populate({
        path: 'rfq',
        select: 'requisitionNumber title',
        populate: {
          path: 'requisition',
          select: 'requisitionNumber'
        }
      })
      .populate({
        path: 'company',
        select: 'name logo'
      })
      .select('poNumber amount createdAt dueDate status deliveryStatus')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Calculate PO distribution by vendor
    const vendorStats = await PurchaseOrder.aggregate([
      { $match: companyQuery },
      {
        $group: {
          _id: "$vendor",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Populate vendor names in the aggregation results
    const populatedVendorStats = await PurchaseOrder.populate(vendorStats, {
      path: '_id',
      select: 'name'
    });

    const stats = {
      success: true,
      data: {
        counts: {
          total,
          pending,
          approved,
          rejected,
          shipped,
          delivered,
          confirmed
        },
        vendorDistribution: populatedVendorStats.map(v => ({
          vendor: v._id?.name || 'Unknown',
          count: v.count,
          totalAmount: v.totalAmount
        })),
        pendingPOs,
        meta: {
          context: {
            company: requestingUser.company,
            isEnterpriseAdmin: requestingUser.isEnterpriseAdmin,
            allCompanies: req.query.allCompanies ? true : false
          }
        }
      }
    };

    console.log("Successfully fetched PO stats");
    res.status(200).json(stats);

  } catch (err) {
    console.error("Error in getPOStats:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ 
      success: false,
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
      po.deliveryStatus = "confirmed"; 

      await po.save();

      console.log("✅ PO confirmed successfully:", po);

      res.status(200).json({ message: "Purchase Order confirmed successfully", po });
  } catch (err) {
      console.error("❌ Error confirming PO:", err);
      res.status(500).json({ message: "Server error", error: err.message });
  }
};



exports.updateDeliveryStatus = async (req, res) => {
  try {
      const {vendorId, trackingNumber, carrier, } = req.body;
      const { id: poId } = req.params;

      console.log(req.body);

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

      // Update the PO with vendor shipping update
      po.vendorConfirmation.confirmed = true;
      po.vendorConfirmation.confirmedAt = new Date();
      po.deliveryStatus = "shipped"; 
      po.trackingNumber = trackingNumber;
      po.carrier = carrier;

      await po.save();

      console.log("✅ PO confirmed successfully:", po);

      res.status(200).json({ message: "Purchase Order confirmed successfully", po });
  } catch (err) {
      console.error("❌ Error confirming PO:", err);
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


  const getStatusColor = (status) => {
  const statusColors = {
    'pending': '#ffc107',
    'approved': '#28a745',
    'rejected': '#dc3545',
    'draft': '#6c757d',
    'in-progress': '#17a2b8',
    'completed': '#28a745',
    'cancelled': '#dc3545'
  };
  return statusColors[status?.toLowerCase()] || '#6c757d';
};

const getDeliveryColor = (deliveryStatus) => {
  const deliveryColors = {
    'pending': '#ffc107',
    'shipped': '#17a2b8',
    'delivered': '#28a745',
    'delayed': '#fd7e14',
    'cancelled': '#dc3545'
  };
  return deliveryColors[deliveryStatus?.toLowerCase()] || '#6c757d';
};
