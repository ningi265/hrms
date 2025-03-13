const Invoice = require("../../models/invoice");
const PurchaseOrder = require("../../models/purchaseOrder");
const { notifyInvoiceSubmitted, notifyInvoiceApproval, notifyInvoicePayment } = require("../services/notificationService");

// Vendor submits an invoice
exports.submitInvoice = async (req, res) => {
    try {
        console.log("Request Body:", req.body); // Log the incoming request body
        const { poId, invoiceNumber, amountDue, vendorId } = req.body; // Include vendorId from frontend

        console.log("Fetching Purchase Order with ID:", poId);
        const po = await PurchaseOrder.findById(poId);

        if (!po) {
            console.log("Purchase Order not found for ID:", poId);
            return res.status(404).json({ message: "Purchase Order not found" });
        }

        console.log("Purchase Order Found:", po);

        // Use vendorId from request body instead of req.user.id
        console.log("Checking if the vendor is authorized...");
        if (po.vendor.toString() !== vendorId) {
            console.log("Unauthorized: Vendor ID does not match PO's vendor ID");
            return res.status(403).json({ message: "Unauthorized: Vendor ID mismatch" });
        }

        console.log("Checking for existing invoice with number:", invoiceNumber);
        const existingInvoice = await Invoice.findOne({ invoiceNumber });
        if (existingInvoice) {
            console.log("Invoice number already exists:", invoiceNumber);
            return res.status(400).json({ message: "Invoice number already exists" });
        }

        console.log("Creating new invoice...");
        const invoice = await Invoice.create({
            po: po._id,
            vendor: po.vendor, // Ensure correct vendor assignment
            amountDue,
            invoiceNumber
        });

        console.log("Invoice created successfully:", invoice);

        console.log("Notifying procurement officer...");
        await notifyInvoiceSubmitted(po.procurementOfficer, invoice);

        console.log("Invoice submitted successfully");
        res.status(201).json({ message: "Invoice submitted successfully", invoice });
    } catch (err) {
        console.error("❌ Error in submitInvoice:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Approve an invoice (Admin Only)
exports.approveInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        invoice.status = "approved";
        invoice.approver = req.user.id;
        await invoice.save();

        await notifyInvoiceApproval(invoice.vendor, invoice);

        res.json({ message: "Invoice approved", invoice });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    } 
};

// Reject an invoice (Admin Only)
exports.rejectInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        invoice.status = "rejected";
        invoice.approver = req.user.id;
        await invoice.save();

        res.json({ message: "Invoice rejected", invoice });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
exports.markAsPaid = async (req, res) => {
    try {
      const { id } = req.params; // Get the invoice ID from the URL
      const { cardNumber, expiryDate, cvv } = req.body; // Get payment details from the request body
  
      // Validate payment details (basic validation)
      if (!cardNumber || !expiryDate || !cvv) {
        return res.status(400).json({ message: "Please provide all payment details" });
      }
  
      // Find the invoice by ID
      const invoice = await Invoice.findById(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
  
      // Check if the invoice is already paid
      if (invoice.status === "paid") {
        return res.status(400).json({ message: "Invoice is already paid" });
      }
  
      // Simulate payment processing (replace with actual payment gateway integration)
      // For now, we'll assume the payment is successful
      const paymentSuccess = true; // Simulate payment success
  
      if (!paymentSuccess) {
        return res.status(400).json({ message: "Payment failed. Please try again." });
      }
  
      // Update the invoice status to "paid"
      invoice.status = "paid";
      await invoice.save();
  
      // Return success response
      res.status(200).json({
        message: "Payment successful. Invoice marked as paid.",
        invoice,
      });
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

// Get all invoices
exports.getAllInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find().populate("po vendor approver", "name email");
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get a single invoice
exports.getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).populate("po vendor approver", "name email");
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        res.json(invoice);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get invoice stats (total, pending, approved, rejected, paid)
exports.getInvoiceStats = async (req, res) => {
    try {
        const total = await Invoice.countDocuments();
        const pending = await Invoice.countDocuments({ status: "pending" });
        const approved = await Invoice.countDocuments({ status: "approved" });
        const rejected = await Invoice.countDocuments({ status: "rejected" });
        const paid = await Invoice.countDocuments({ status: "paid" });

        const stats = {
            total,
            pending,
            approved,
            rejected,
            paid,
        };

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


