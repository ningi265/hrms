const Vendor = require("../../models/registration");
const User = require("../../models/user");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');



// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD, // Use app password for Gmail
  },
});
// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/vendor-documents/';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'power-of-attorney-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept only PDF, DOC, DOCX files
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExt)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

// Register a new vendor with complete registration information
{/*exports.registerVendor = async (req, res) => {
    try {
        const {
            
            // Registration form data
            countryOfRegistration,
            businessName,
            taxpayerIdentificationNumber,
            tinIssuedDate,
            companyType,
            formOfBusiness,
            ownershipType,
            selectBusiness,
            registrationNumber,
            registrationIssuedDate,
            termsAccepted
        } = req.body;

        console.log("Vendor registration request:", req.body);

        // Validate required fields
        if (!businessName || !taxpayerIdentificationNumber || !registrationNumber) {
            return res.status(400).json({ 
                message: "Missing required fields: businessName, taxpayerIdentificationNumber, registrationNumber" 
            });
        }

        if (!termsAccepted) {
            return res.status(400).json({ 
                message: "Terms and conditions must be accepted" 
            });
        }

        // Check if vendor already exists with same email, TIN, or registration number
        const existingVendor = await Vendor.findOne({
            $or: [
                { email },
                { taxpayerIdentificationNumber },
                { registrationNumber }
            ]
        });

        if (existingVendor) {
            let message = "Vendor already exists with this ";
            if (existingVendor.email === email) message += "email";
            else if (existingVendor.taxpayerIdentificationNumber === taxpayerIdentificationNumber) message += "TIN";
            else if (existingVendor.registrationNumber === registrationNumber) message += "registration number";
            
            return res.status(400).json({ message });
        }

        // Create user account for the vendor
        const user = await User.create({
            firstName: firstName || businessName.split(' ')[0],
            lastName: lastName || businessName.split(' ').slice(1).join(' ') || 'Company',
            email,
            password,
            phoneNumber,
            companyName: businessName,
            industry: selectBusiness || "General",
            role: "employee",
        });

        // Handle file upload information
        let powerOfAttorneyInfo = {};
        if (req.file) {
            powerOfAttorneyInfo = {
                fileName: req.file.originalname,
                filePath: req.file.path,
                fileSize: req.file.size,
                uploadDate: new Date()
            };
        }

        // Create vendor with registration information
        const vendor = await Vendor.create({
            // Basic vendor info
            name: businessName,
            email,
            phone: phoneNumber,
            address: `${countryOfRegistration}`, // Basic address, can be expanded
            categories: [selectBusiness],
            user: user._id,
            
            // Registration information
            countryOfRegistration,
            businessName,
            taxpayerIdentificationNumber,
            tinIssuedDate: new Date(tinIssuedDate),
            companyType,
            formOfBusiness,
            ownershipType,
            businessCategory: selectBusiness,
            registrationNumber,
            registrationIssuedDate: new Date(registrationIssuedDate),
            
            // Document
            powerOfAttorney: powerOfAttorneyInfo,
            
            // Terms
            termsAccepted: true,
            termsAcceptedDate: new Date(),
            
            // Status
            registrationStatus: "pending",
            submissionDate: new Date()
        });

        res.status(201).json({ 
            message: "Vendor registration submitted successfully. You will receive notification once reviewed.", 
            vendor: {
                id: vendor._id,
                businessName: vendor.businessName,
                email: vendor.email,
                registrationStatus: vendor.registrationStatus,
                submissionDate: vendor.submissionDate
            }
        });

    } catch (err) {
        console.error("Error registering vendor:", err);
        
        // Clean up uploaded file if vendor creation failed
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
*/}
// Get vendor registration status
exports.getRegistrationStatus = async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const vendor = await Vendor.findOne({ email })
            .select('businessName email registrationStatus submissionDate approvalDate rejectionReason');
        
        if (!vendor) {
            return res.status(404).json({ message: "Vendor registration not found" });
        }

        res.json({
            businessName: vendor.businessName,
            email: vendor.email,
            status: vendor.registrationStatus,
            submissionDate: vendor.submissionDate,
            approvalDate: vendor.approvalDate,
            rejectionReason: vendor.rejectionReason
        });

    } catch (err) {
        console.error("Error getting registration status:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get all pending vendor registrations (for admin)
exports.getPendingRegistrations = async (req, res) => {
    try {
        const pendingVendors = await Vendor.find({ registrationStatus: "pending" })
            .populate('user', 'firstName lastName email')
            .sort({ submissionDate: -1 });

        res.json(pendingVendors);
    } catch (err) {
        console.error("Error getting pending registrations:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Approve vendor registration (admin only)
exports.approveVendor = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const reviewerId = req.user._id; // Assuming admin user is authenticated

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        if (vendor.registrationStatus !== "pending") {
            return res.status(400).json({ message: "Vendor registration is not pending" });
        }

        await vendor.approve(reviewerId);

        // Here you could send approval email to vendor
        
        res.json({ 
            message: "Vendor approved successfully", 
            vendor: {
                id: vendor._id,
                businessName: vendor.businessName,
                status: vendor.registrationStatus,
                approvalDate: vendor.approvalDate
            }
        });

    } catch (err) {
        console.error("Error approving vendor:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Reject vendor registration (admin only)
exports.rejectVendor = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const reviewerId = req.user._id;

       
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        if (vendor.registrationStatus !== "pending") {
            return res.status(400).json({ message: "Vendor registration is not pending" });
        }

        await vendor.reject( reviewerId);

        // Here you could send rejection email to vendor
        
        res.json({ 
            message: "Vendor registration rejected", 
            vendor: {
                id: vendor._id,
                businessName: vendor.businessName,
                status: vendor.registrationStatus,
            }
        });

    } catch (err) {
        console.error("Error rejecting vendor:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get vendor details by ID
exports.getVendorDetails = async (req, res) => {
    try {
        const { vendorId } = req.params;
        
        const vendor = await Vendor.findById(vendorId)
            .populate('user', 'firstName lastName email phoneNumber')
            .populate('reviewedBy', 'firstName lastName');

        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        res.json(vendor);
    } catch (err) {
        console.error("Error getting vendor details:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Original methods (keeping for compatibility)
exports.addVendor = async (req, res) => {
    try {
        const { 
            firstName, 
            lastName, 
            email, 
            phoneNumber, 
            address, 
            categories, 
            password,
            companyName,
            industry,
            role = "employee"
        } = req.body;
        
        console.log("req body", req.body);

        const existingVendor = await Vendor.findOne({ email });
        if (existingVendor) {
            return res.status(400).json({ message: "Vendor with this email already exists" });
        }

        const user = await User.create({
            firstName,
            lastName,
            email,
            password,
            phoneNumber,
            companyName: companyName || `${firstName} ${lastName} Company`,
            industry: industry || "General",
            role: "employee",
        });

        const vendor = await Vendor.create({
            name: `${firstName || ''} ${lastName || ''}`.trim() || 'Unnamed Vendor',
            email,
            phone: phoneNumber,
            address: address || '',
            categories: Array.isArray(categories) ? categories : [],
            user: user._id,
            businessName: companyName || `${firstName} ${lastName} Company`,
            taxpayerIdentificationNumber: `TIN-${Date.now()}`, // Temporary TIN
            registrationNumber: `REG-${Date.now()}`, // Temporary registration
            tinIssuedDate: new Date(),
            registrationIssuedDate: new Date(),
            companyType: "Private Limited Company",
            formOfBusiness: "Limited Liability Company",
            ownershipType: "Private Ownership",
            businessCategory: industry || "Other",
            countryOfRegistration: "Malawi",
            registrationStatus: "approved", // Auto-approve for old method
            termsAccepted: true,
            termsAcceptedDate: new Date()
        });

        res.status(201).json({ message: "Vendor added successfully", vendor });
    } catch (err) {
        console.error("Error adding vendor:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getVendorByUser = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });
        if (!vendor) return res.status(404).json({ message: "Vendor not found" });

        res.json(vendor);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getVendors = async (req, res) => {
    try {
        const vendors = await User.find({ role: "Vendor" }).populate("firstName", "firstName email");
        res.json(vendors);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.updateVendor = async (req, res) => {
    try {
        const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!vendor) return res.status(404).json({ message: "Vendor not found" });

        res.json({ message: "Vendor updated", vendor });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.deleteVendor = async (req, res) => {
    try {
        const vendorId = req.params.id;
        
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        // Delete associated file if exists
        if (vendor.powerOfAttorney && vendor.powerOfAttorney.filePath) {
            if (fs.existsSync(vendor.powerOfAttorney.filePath)) {
                fs.unlinkSync(vendor.powerOfAttorney.filePath);
            }
        }

        await Vendor.findByIdAndDelete(vendorId);
        
        if (vendor.user) {
            await User.findByIdAndDelete(vendor.user);
        }

        res.json({ message: "Vendor deleted successfully" });
    } catch (err) {
        console.error("Error deleting vendor:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Export multer upload middleware
exports.uploadPowerOfAttorney = upload.single('powerOfAttorney');






// Function to generate PDF
const generateVendorRegistrationPDF = (vendorData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const pdfPath = path.join(__dirname, '../../temp', `vendor-registration-${Date.now()}.pdf`);
      
      // Ensure temp directory exists
      if (!fs.existsSync(path.dirname(pdfPath))) {
        fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
      }
      
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);
      
      // PDF styling
      doc.fontSize(20).text('Vendor Registration Details', { align: 'center' });
      doc.moveDown();
      
      // Basic Information Section
      doc.fontSize(16).text('1. Basic Information', { underline: true });
      doc.fontSize(12);
      doc.text(`Business Name: ${vendorData.businessName}`);
      doc.text(`Country of Registration: ${vendorData.countryOfRegistration}`);
      doc.text(`Taxpayer Identification Number (TIN): ${vendorData.taxpayerIdentificationNumber}`);
      doc.text(`TIN Issued Date: ${new Date(vendorData.tinIssuedDate).toLocaleDateString()}`);
      doc.text(`Company Type: ${vendorData.companyType}`);
      doc.text(`Form of Business: ${vendorData.formOfBusiness}`);
      doc.text(`Ownership Type: ${vendorData.ownershipType}`);
      doc.moveDown();
      
      // Business Details Section
      doc.fontSize(16).text('2. Business Details', { underline: true });
      doc.fontSize(12);
      doc.text(`Business Category: ${vendorData.selectBusiness}`);
      doc.text(`Registration Number: ${vendorData.registrationNumber}`);
      doc.text(`Registration Issued Date: ${new Date(vendorData.registrationIssuedDate).toLocaleDateString()}`);
      doc.moveDown();
      
      // Submission Details
      doc.fontSize(16).text('3. Submission Details', { underline: true });
      doc.fontSize(12);
      doc.text(`Submission Date: ${new Date().toLocaleString()}`);
      doc.text(`Status: Pending Review`);
      doc.moveDown();
      
      doc.end();
      
      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
};

// Function to send email with PDF attachment
const sendRegistrationEmail = async (vendorData, pdfPath) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM_NAME,
      to: 'ndawamtonga68@gmail.com', // Procurement officer's email
      subject: 'New Vendor Registration Submission',
      html: `
        <h2>New Vendor Registration</h2>
        <p>A new vendor registration has been submitted for review:</p>
        <ul>
          <li><strong>Business Name:</strong> ${vendorData.businessName}</li>
          <li><strong>Registration Number:</strong> ${vendorData.registrationNumber}</li>
          <li><strong>TIN:</strong> ${vendorData.taxpayerIdentificationNumber}</li>
          <li><strong>Submission Date:</strong> ${new Date().toLocaleString()}</li>
        </ul>
        <p>Please review the attached PDF for complete details.</p>
        <p>You can approve or reject this registration from the admin portal.</p>
      `,
      attachments: [
        {
          filename: `Vendor_Registration_${vendorData.businessName.replace(/\s+/g, '_')}.pdf`,
          path: pdfPath
        }
      ]
    };
    
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Error sending email:', err);
    return false;
  }
};

const sendRegistrationApprovalEmail = async (vendorData, pdfPath) => {
  try {
    // Vendor Notification
    const vendorEmail = vendorData.vendor?.email;
    if (!vendorEmail) {
      console.warn('Vendor email missing from vendorData');
    } else {
      const vendorMailOptions = {
        from: process.env.EMAIL_FROM_NAME,
        to: vendorEmail,
        subject: 'Your Vendor Registration Has Been Approved',
       html: `
  <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 30px;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
      <div style="text-align: center;">
        <h1 style="color: #4CAF50; margin-bottom: 0;">🎉 Congratulations!</h1>
        <p style="color: #666; font-size: 16px; margin-top: 5px;">Your vendor registration has been <strong>approved</strong>.</p>
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />

      <div style="font-size: 16px; color: #333;">
        <p>Dear ${vendorData.vendor?.firstName || "Vendor"},</p>

        <p>We are pleased to inform you that your vendor application with the following details has been successfully approved:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; font-weight: bold;">Business Name:</td>
            <td style="padding: 10px;">${vendorData.businessName}</td>
          </tr>
          <tr style="background-color: #f2f2f2;">
            <td style="padding: 10px; font-weight: bold;">Registration Number:</td>
            <td style="padding: 10px;">${vendorData.registrationNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">TIN:</td>
            <td style="padding: 10px;">${vendorData.taxpayerIdentificationNumber}</td>
          </tr>
          <tr style="background-color: #f2f2f2;">
            <td style="padding: 10px; font-weight: bold;">Approval Date:</td>
            <td style="padding: 10px;">${new Date().toLocaleString()}</td>
          </tr>
        </table>

        <p>You now have full access to vendor services and can begin engaging with procurement opportunities on our platform.</p>

        <p style="margin-top: 30px;">If you have any questions or need further assistance, please contact us at <a href="mailto:support@nyasatech.mw">support@nyasatech.mw</a>.</p>

        <p style="margin-top: 40px;">Warm regards,<br /><strong>The Procurement Team</strong></p>
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />

      <div style="text-align: center; font-size: 12px; color: #999;">
        &copy; ${new Date().getFullYear()} Nyasa Supply Chain. All rights reserved.
      </div>
    </div>
  </div>
`
      };

      await transporter.sendMail(vendorMailOptions);
    }
    return true;
  } catch (err) {
    console.error('Error sending email:', err);
    return false;
  }
};

const sendRegistrationRejectionEmail = async (vendorData) => {
  try {
    const vendorEmail = vendorData.vendor?.email;
    if (!vendorEmail) {
      console.warn('Vendor email missing from vendorData');
    } else {
      const rejectionMailOptions = {
        from: process.env.EMAIL_FROM_NAME,
        to: vendorEmail,
        subject: 'Your Vendor Registration Has Been Rejected',
        html: `
  <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 30px;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
      <div style="text-align: center;">
        <h1 style="color: #E53935; margin-bottom: 0;">⚠️ Registration Rejected</h1>
        <p style="color: #666; font-size: 16px; margin-top: 5px;">Unfortunately, your vendor registration could not be approved.</p>
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />

      <div style="font-size: 16px; color: #333;">
        <p>Dear ${vendorData.vendor?.firstName || "Vendor"},</p>

        <p>After reviewing your application, we regret to inform you that it has not been successful. Here are the details:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; font-weight: bold;">Business Name:</td>
            <td style="padding: 10px;">${vendorData.businessName}</td>
          </tr>
          <tr style="background-color: #f2f2f2;">
            <td style="padding: 10px; font-weight: bold;">Registration Number:</td>
            <td style="padding: 10px;">${vendorData.registrationNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">TIN:</td>
            <td style="padding: 10px;">${vendorData.taxpayerIdentificationNumber}</td>
          </tr>
          <tr style="background-color: #f2f2f2;">
            <td style="padding: 10px; font-weight: bold;">Review Date:</td>
            <td style="padding: 10px;">${new Date().toLocaleString()}</td>
          </tr>
        </table>

        <p>You are welcome to reapply in the future after addressing the issues that led to this outcome.</p>

        <p style="margin-top: 30px;">For questions or support, please contact us at <a href="mailto:support@nyasatech.mw">support@nyasatech.mw</a>.</p>

        <p style="margin-top: 40px;">Warm regards,<br /><strong>The Procurement Team</strong></p>
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />

      <div style="text-align: center; font-size: 12px; color: #999;">
        &copy; ${new Date().getFullYear()} Nyasa Supply Chain. All rights reserved.
      </div>
    </div>
  </div>
`
      };

      await transporter.sendMail(rejectionMailOptions);
    }
    return true;
  } catch (err) {
    console.error('Error sending rejection email:', err);
    return false;
  }
};



// Updated registerVendor function
exports.registerVendor = async (req, res) => {
  try {
    
    const {
      countryOfRegistration,
      businessName,
      taxpayerIdentificationNumber,
      tinIssuedDate,
      companyType,
      formOfBusiness,
      ownershipType,
      selectBusiness,
      registrationNumber,
      registrationIssuedDate,
      termsAccepted,
      phoneNumber
    } = req.body;

    console.log(req.body);

    // Validate required fields
    if (!businessName || !taxpayerIdentificationNumber || !registrationNumber) {
      return res.status(400).json({ 
        message: "Missing required fields" 
      });
    }

    if (!termsAccepted) {
      return res.status(400).json({ 
        message: "Terms and conditions must be accepted" 
      });
    }

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({
      $or: [
        { taxpayerIdentificationNumber },
        { registrationNumber }
      ]
    });

    if (existingVendor) {
      let message = "Vendor already exists with this ";
    if (existingVendor.taxpayerIdentificationNumber === taxpayerIdentificationNumber) message += "TIN";
      else if (existingVendor.registrationNumber === registrationNumber) message += "registration number";
      
      return res.status(400).json({ message });
    }

    // Handle file upload information
    let powerOfAttorneyInfo = {};
    if (req.file) {
      powerOfAttorneyInfo = {
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        uploadDate: new Date()
      };
    }

    // Save vendor information
    const vendor = await Vendor.create({
       vendor:req.user._id,
      name: businessName,
      phone: phoneNumber,
      address: `${countryOfRegistration}`,
      categories: [selectBusiness],
      countryOfRegistration,
      businessName,
      taxpayerIdentificationNumber,
      tinIssuedDate: new Date(tinIssuedDate),
      companyType,
      formOfBusiness,
      ownershipType,
      businessCategory: selectBusiness,
      registrationNumber,
      registrationIssuedDate: new Date(registrationIssuedDate),
      powerOfAttorney: powerOfAttorneyInfo,
      termsAccepted: true,
      termsAcceptedDate: new Date(),
      registrationStatus: "pending",
      submissionDate: new Date()
    });

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    } else {
      // Update user with vendor information
      user.registrationStatus = "pending";           
      await user.save();
    }
    // Generate PDF with registration details
    const pdfPath = await generateVendorRegistrationPDF({
      ...req.body,
      submissionDate: new Date()
    });

    // Send email notification with PDF attachment
    await sendRegistrationEmail(vendor, pdfPath);

    // Clean up the temporary PDF file
    fs.unlinkSync(pdfPath);

    res.status(201).json({ 
      message: "Vendor registration submitted successfully. You will receive notification once reviewed.", 
      vendor: {
        id: vendor._id,
        businessName: vendor.businessName,
        registrationStatus: vendor.registrationStatus,
        submissionDate: vendor.submissionDate
      }
    });

  } catch (err) {
    console.error("Error registering vendor:", err);
    
    // Clean up uploaded file if vendor creation failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getPendingRegistrations = async (req, res) => {
    try {
        const pendingVendors = await Vendor.find({ registrationStatus: "pending" })
            .populate('vendor', 'firstName lastName email')
            .sort({ submissionDate: -1 });
        res.json(pendingVendors);
    }
    catch (err) {
        console.error("Error getting pending registrations:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}


exports.getVendorRegistrationData = async (req, res) => {
    const vendorId =  req.user._id;  

    try {
        const registrationData = await Vendor.findOne({ vendor: vendorId })
            .populate('vendor', 'firstName lastName phoneNumber email');

        if (!registrationData) {
            return res.status(404).json({ message: "Registration data not found for this vendor." });
        }

        res.json(registrationData);
    } catch (err) {
        console.error("Error fetching vendor registration data:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


// Approve vendor registration (admin only)
exports.approveVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const reviewerId = req.user._id;

    // Populate to get vendor.vendor (User object with email)
    const vendor = await Vendor.findById(vendorId).populate("vendor");
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    if (vendor.registrationStatus !== "pending") {
      return res.status(400).json({ message: "Vendor registration is not pending" });
    }

    // Approve the vendor
    vendor.registrationStatus = "approved";
    vendor.reviewedBy = reviewerId;
    vendor.approvalDate = new Date();
    await vendor.save();

    // Update user's registration status
    const userId = vendor.vendor?._id;
    if (!userId) {
      return res.status(400).json({ message: "Vendor's user reference is missing" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Vendor's user not found" });
    }

    user.registrationStatus = "approved";
    await user.save();

    // Send approval email to vendor
    const emailSent = await sendRegistrationApprovalEmail(vendor /*, pdfPath */);
    if (!emailSent) {
      console.warn("Email not sent to vendor.");
    }

    res.json({
      message: "Vendor approved successfully",
      vendor: {
        id: vendor._id,
        businessName: vendor.businessName,
        status: vendor.registrationStatus,
        approvalDate: vendor.approvalDate
      }
    });
  } catch (err) {
    console.error("Error approving vendor:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.rejectVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const reviewerId = req.user._id;

    // Populate to get vendor.vendor (User object with email)
    const vendor = await Vendor.findById(vendorId).populate("vendor");
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    if (vendor.registrationStatus !== "pending") {
      return res.status(400).json({ message: "Vendor registration is not pending" });
    }

    // Approve the vendor
    vendor.registrationStatus = "rejected";
    vendor.reviewedBy = reviewerId;
    vendor.approvalDate = new Date();
    await vendor.save();

    // Update user's registration status
    const userId = vendor.vendor?._id;
    if (!userId) {
      return res.status(400).json({ message: "Vendor's user reference is missing" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Vendor's user not found" });
    }

    user.registrationStatus = "rejected";
    await user.save();

    // Send approval email to vendor
    const emailSent = await sendRegistrationRejectionEmail(vendor /*, pdfPath */);
    if (!emailSent) {
      console.warn("Email not sent to vendor.");
    }

    res.json({
      message: "Vendor rejected successfully",
      vendor: {
        id: vendor._id,
        businessName: vendor.businessName,
        status: vendor.registrationStatus,
      }
    });
  } catch (err) {
    console.error("Error rejecting vendor:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// Get vendor details by ID
exports.getVendorDetails = async (req, res) => {
    try {
        const { vendorId } = req.params;
        
        const vendor = await Vendor.findById(vendorId)
            .populate('user', 'firstName lastName email phoneNumber')
            .populate('reviewedBy', 'firstName lastName');

        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        res.json(vendor);
    } catch (err) {
        console.error("Error getting vendor details:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};  
// Export multer upload middleware
exports.uploadPowerOfAttorney = upload.single('powerOfAttorney');
exports.getVendorByUser = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });
        if (!vendor) return res.status(404).json({ message: "Vendor not found" });

        res.json(vendor);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

