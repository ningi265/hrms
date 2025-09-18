const Vendor = require("../../models/vendor");
const User = require("../../models/user");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const calculatePreQualScore = require("../../utils/scoreCalculator");
const VendorPreQualification = require("../../models/vendorPreQualification");


// Email configuration
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const fieldName = file.fieldname;
        let uploadDir = 'uploads/vendor-documents/';
        
        // Create subdirectories based on document type
        if (fieldName.includes('Certificate') || fieldName.includes('License')) {
            uploadDir += 'certificates-licenses/';
        } else if (fieldName.includes('Tax') || fieldName.includes('VAT')) {
            uploadDir += 'tax-documents/';
        } else if (fieldName.includes('Financial') || fieldName.includes('Audit') || fieldName.includes('Bank')) {
            uploadDir += 'financial-documents/';
        } else if (fieldName.includes('Experience') || fieldName.includes('Personnel') || fieldName.includes('Equipment')) {
            uploadDir += 'technical-capacity/';
        } else if (fieldName.includes('Client') || fieldName.includes('Project') || fieldName.includes('Performance')) {
            uploadDir += 'past-performance/';
        } else if (fieldName.includes('Safety') || fieldName.includes('Environment') || fieldName.includes('Sustainability')) {
            uploadDir += 'hse-documents/';
        } else if (fieldName.includes('CSR') || fieldName.includes('Ethics')) {
            uploadDir += 'ethics-governance/';
        } else {
            uploadDir += 'other-documents/';
        }
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate descriptive filename with purpose
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fieldName = file.fieldname;
        const originalName = path.parse(file.originalname).name;
        const extension = path.extname(file.originalname);
        
        // Map field names to human-readable purposes
        const purposeMap = {
            'registrationCertificate': 'Business-Registration-Certificate',
            'businessLicense': 'Business-License',
            'taxClearance': 'Tax-Clearance-Certificate',
            'vatRegistration': 'VAT-Registration',
            'industryLicenses': 'Industry-License',
            'auditedStatements': 'Audited-Financial-Statement',
            'relevantExperience': 'Relevant-Experience-Document',
            'keyPersonnel': 'Key-Personnel-CV',
            'equipmentFacilities': 'Equipment-Facilities',
            'qualityCertifications': 'Quality-Certification',
            'clientReferences': 'Client-Reference',
            'completedProjects': 'Completed-Project',
            'safetyRecords': 'Safety-Record',
            'sustainabilityPractices': 'Sustainability-Practice',
            'environmentCertificate': 'Environment-Certificate',
            'csrInitiatives': 'CSR-Initiative'
        };
        
        const purpose = purposeMap[fieldName] || fieldName;
        
        // Format: purpose-originalname-timestamp-random.extension
        const filename = `${purpose}-${originalName}-${uniqueSuffix}${extension}`;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    // Accept only specific file types based on field name
    const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    // Different file requirements for different document types
    const financialDocuments = ['auditedStatements', 'taxClearance', 'vatRegistration'];
    const imageDocuments = ['registrationCertificate', 'businessLicense', 'environmentCertificate'];
    
    if (financialDocuments.includes(file.fieldname) && !['.pdf', '.xlsx', '.xls'].includes(fileExt)) {
        return cb(new Error('Financial documents must be PDF or Excel files'), false);
    }
    
    if (imageDocuments.includes(file.fieldname) && !['.jpg', '.jpeg', '.png', '.pdf'].includes(fileExt)) {
        return cb(new Error('Certificates must be image files or PDF'), false);
    }
    
    if (allowedTypes.includes(fileExt)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOC, DOCX, JPG, JPEG, and PNG files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

const uploadDocs = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
}).fields([
  { name: "registrationCertificate", maxCount: 1 },
  { name: "businessLicense", maxCount: 1 },
  { name: "taxClearance", maxCount: 1 },
  { name: "vatRegistration", maxCount: 1 },
  { name: "industryLicenses", maxCount: 10 },
  { name: "auditedStatements", maxCount: 5 },
  { name: "relevantExperience", maxCount: 5 },
  { name: "keyPersonnel", maxCount: 5 },
  { name: "equipmentFacilities", maxCount: 5 },
  { name: "qualityCertifications", maxCount: 5 },
  { name: "clientReferences", maxCount: 5 },
  { name: "completedProjects", maxCount: 5 },
  { name: "safetyRecords", maxCount: 5 },
  { name: "sustainabilityPractices", maxCount: 5 },
  { name: "csrInitiatives", maxCount: 5 },
  { name: "environmentCertificate", maxCount: 1 }
]);

exports.uploadDocs = uploadDocs;

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
  console.log("Incoming Create Vendor Request:", req.body);                         
  try {
    const requestingUser = await User.findById(req.user._id);
    if (!requestingUser.isEnterpriseAdmin && requestingUser.role !== "Enterprise(CEO, CFO, etc.)") {
      return res.status(403).json({ message: "Unauthorized to add vendors" });
    }

    const { 
      firstName,
      lastName, 
      email, 
      phoneNumber, 
      address, 
      categories, 
      companyName,
      businessName,
      industry,
      taxpayerIdentificationNumber,
      registrationNumber,
      companyType,
      formOfBusiness,
      ownershipType,
      countryOfRegistration = "Malawi",
      role = "Vendor"
    } = req.body;

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({ 
      email: email.toLowerCase(),
      company: requestingUser.company 
    });
    if (existingVendor) {
      return res.status(400).json({ message: "Vendor with this email already exists" });
    }

    // Get company subscription details
    const companySubscription = requestingUser.billing?.subscription || {
      plan: "trial", // Fixed typo: "trail" -> "trial"
      status: "trialing", // Fixed typo: "trailing" -> "trialing"
    };

    let trialEndDate = requestingUser.billing?.trialEndDate || null;
    let subscriptionEndDate = companySubscription.currentPeriodEnd || null;
    let subscriptionStatus = companySubscription.status || "trialing";

    // Generate registration token
    const registrationToken = crypto.randomBytes(32).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
      
    const registrationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Create new User record for the vendor
    const newVendor = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phoneNumber,
      address, // Add this field
      companyName: companyName || `${firstName} ${lastName} Company`,
      role: "Vendor",
      industry,
      company: requestingUser.company, // Add company reference
      registrationToken,
      registrationTokenExpires,
      registrationStatus: 'pending',
      billing: {
        trialStartDate: requestingUser.billing?.trialStartDate || new Date(),
        trialEndDate: trialEndDate,
        subscription: {
          plan: companySubscription.plan,
          status: subscriptionStatus,
          currentPeriodStart: companySubscription.currentPeriodStart || new Date(),
          currentPeriodEnd: subscriptionEndDate,
          cancelAtPeriodEnd: companySubscription.cancelAtPeriodEnd || false,
          subscriptionId: companySubscription.subscriptionId || null,
          priceId: companySubscription.priceId || null
        }
      }
    });

    const savedVendorUser = await newVendor.save();

    // Create Vendor record
    const vendor = await Vendor.create({
      name: `${firstName || ''} ${lastName || ''}`.trim() || 'Unnamed Vendor',
      email: email.toLowerCase(),
      phoneNumber,
      address: address || '',
      categories: Array.isArray(categories) ? categories : [],
      businessCategory: categories && categories.length > 0 ? categories[0] : 'General', // Use first category as business category
      businessName: businessName || companyName || `${firstName} ${lastName} Company`,
      companyType: companyType || "Private Limited Company",
      formOfBusiness: formOfBusiness || "Limited Liability Company",
      ownershipType: ownershipType || "Private Ownership",
      countryOfRegistration: countryOfRegistration,
      tinIssuedDate: new Date(),
      registrationIssuedDate: new Date(),
      registrationStatus: "pending",
      termsAccepted: true,
      termsAcceptedDate: new Date(),
      user: requestingUser._id, 
      company: requestingUser.company, 
      vendor: savedVendorUser._id 
    });

    // Create registration link
    const registrationLink = `${process.env.FRONTEND_URL}/complete-registration?token=${encodeURIComponent(registrationToken)}&email=${encodeURIComponent(email)}`;

    // Email configuration
    const msg = {
      to: email,
      from: {
        name: requestingUser.companyName || 'NexusMWI',
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@nexusmwi.com'
      },
      subject: `Complete Your Registration - ${requestingUser.companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333;">Welcome to ${requestingUser.companyName}</h2>
          <p>Dear ${firstName} ${lastName},</p>
          <p>Your vendor account has been created by ${requestingUser.firstName} ${requestingUser.lastName}.</p>
          <p>Please complete your registration by clicking the button below:</p>
          <div style="margin: 20px 0; text-align: center;">
            <a href="${registrationLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Complete Registration</a>
          </div>
          <p style="font-size: 12px; color: #777;">Or copy and paste this link into your browser: ${registrationLink}</p>
          <p><strong>Important:</strong> This link expires in 24 hours.</p>
          <p>If you didn't expect this email, please contact your administrator.</p>
          <p>Best regards,<br/>${requestingUser.companyName} Team</p>
        </div>
      `,
      text: `Welcome to ${requestingUser.companyName}\n\nDear ${firstName} ${lastName},\n\nYour vendor account has been created by ${requestingUser.firstName} ${requestingUser.lastName}.\n\nPlease complete your registration by visiting this link:\n${registrationLink}\n\nImportant: This link expires in 24 hours.\n\nIf you didn't expect this email, please ignore it.\n\nBest regards,\n${requestingUser.companyName} Team`
    };

    try {
      // Send email via SendGrid API
      await sgMail.send(msg);
      console.log(`Registration email sent to ${email}`);
      
      // Send single success response
      return res.status(201).json({
        success: true,
        message: 'Vendor created successfully. Registration email sent.',
        code: "VENDOR_CREATED",
        vendor: {
          id: savedVendorUser._id,
          vendorRecordId: vendor._id,
          firstName,
          lastName,
          email,
          status: 'pending',
          subscriptionPlan: companySubscription.plan,
          subscriptionEndDate: subscriptionEndDate || trialEndDate,
          registrationTokenExpires: new Date(registrationTokenExpires)
        },
        meta: {
          emailSent: true
        }
      });
      
    } catch (sendGridError) {
      console.error('Failed to send registration email:', sendGridError);
      
      // Clean up the created records if email fails
      await User.findByIdAndDelete(savedVendorUser._id);
      await Vendor.findByIdAndDelete(vendor._id);
      
      return res.status(500).json({
        success: false,
        message: "Vendor creation failed due to email send error",
        code: "EMAIL_SEND_FAILED",
        error: process.env.NODE_ENV === 'development' ? sendGridError.message : undefined
      });
    }

  } catch (err) {
    console.error("Error adding vendor:", err);
    return res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: err.message 
    });
  }
};


// Send pre-qualification results via email
exports.sendPreQualEmail = async (req, res) => {
  try {
    const { tenderTitle, preQualStatus, preQualScore, vendorId } = req.body;
    
    // Get vendor details
    const vendor = await Vendor.findById(vendorId).populate('vendor');
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendorEmail = vendor.vendor?.email;
    if (!vendorEmail) {
      return res.status(400).json({ message: "Vendor email not found" });
    }

    // Email content based on status
    let subject, html;
    
    if (preQualStatus === "approved") {
      subject = `Pre-qualification Approved for ${tenderTitle}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Pre-qualification Approved</h2>
          <p>Dear ${vendor.vendor.firstName || "Vendor"},</p>
          <p>We are pleased to inform you that your pre-qualification for the tender <strong>${tenderTitle}</strong> has been <strong>approved</strong>.</p>
          <p>Your pre-qualification score: <strong>${preQualScore}/100</strong></p>
          <p>You may now proceed with the full application process for this tender.</p>
          <p>Best regards,<br/>Procurement Team</p>
        </div>
      `;
    } else {
      subject = `Pre-qualification Results for ${tenderTitle}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E53935;">Pre-qualification Results</h2>
          <p>Dear ${vendor.vendor.firstName || "Vendor"},</p>
          <p>Thank you for your interest in the tender <strong>${tenderTitle}</strong>.</p>
          <p>After reviewing your pre-qualification submission, we regret to inform you that your application did not meet the minimum requirements at this time.</p>
          <p>Your pre-qualification score: <strong>${preQualScore}/100</strong></p>
          <p>Minimum required score: <strong>70/100</strong></p>
          <h3>Areas for Improvement:</h3>
          <ul>
            <li>Ensure all required documents are submitted</li>
            <li>Provide complete financial statements</li>
            <li>Include relevant experience and past performance records</li>
            <li>Verify all legal and compliance documentation</li>
          </ul>
          <p>You are welcome to update your vendor profile and try again in the future.</p>
          <p>For specific feedback on your application, please contact our procurement department.</p>
          <p>Best regards,<br/>Procurement Team</p>
        </div>
      `;
    }

    // Send email using your existing email system
    const msg = {
      to: vendorEmail,
      from: {
        name: 'Procurement System',
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@nexusmwi.com'
      },
      subject: subject,
      html: html
    };

    await sgMail.send(msg);

    res.status(200).json({ 
      success: true, 
      message: "Pre-qualification email sent successfully" 
    });

  } catch (err) {
    console.error("Error sending pre-qual email:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send email",
      error: err.message 
    });
  }
};


exports.getVendorsAdmin = async (req, res) => {
    try {
        const vendors = await User.find({ role: "Vendor" }).populate("firstName", "firstName email");
        res.json(vendors);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


exports.getVendors = async (req, res) => {
  try {
    // Check authentication and get user company
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    // Get requesting user's company and admin status
    const requestingUser = await User.findById(req.user._id)
      .select('company isEnterpriseAdmin');
    
    if (!requestingUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }
    const allowedRoles = [
    "Vendor",
   ];
    // Base query - filter by company unless enterprise admin requests all
   const baseQuery = requestingUser.role === 'Enterprise(CEO, CFO, etc.)' && req.query.allCompanies === 'true'
  ? { role: { $in: allowedRoles } }
  : { 
      company: requestingUser.company,
      role: { $in: allowedRoles }
    };


    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    // Sorting parameters
    const sortField = req.query.sortBy || 'lastName';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortOrder };

    // Filter parameters
    const statusFilter = req.query.status 
      ? { status: req.query.status } 
      : {};

    // Search parameter
    const searchQuery = req.query.search
      ? {
          $or: [
            { firstName: { $regex: req.query.search, $options: 'i' } },
            { lastName: { $regex: req.query.search, $options: 'i' } },
            { email: { $regex: req.query.search, $options: 'i' } },
            { employeeId: { $regex: req.query.search, $options: 'i' } }
          ]
        }
      : {};

    // Combine all query conditions
    const query = {
      ...baseQuery,
      ...statusFilter,
      ...searchQuery
    };

    // Get vendors with pagination and sorting
    const vendors = await User.find(query)
      .select('-password -verificationCode -refreshToken')
      .populate({
        path: 'company',
        select: 'name industry'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await User.countDocuments(query);

    // Get status counts
    const statusCounts = await User.aggregate([
      { $match: baseQuery },
      { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert status counts to object
    const statusStats = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    console.log(`Fetched ${vendors.length} vendors from company ${requestingUser.company}`);

    res.status(200).json({
      success: true,
      data: vendors,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        statusStats,
        sort: `${sortField}:${sortOrder === 1 ? 'asc' : 'desc'}`,
        filters: {
          search: req.query.search || null,
          status: req.query.status || null
        },
        context: {
          isEnterpriseAdmin: requestingUser.isEnterpriseAdmin,
          allCompanies: req.query.allCompanies === 'true'
        }
      }
    });

  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching vendors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
    console.log("Incoming Vendor Registration Request:", req.body);
    // Parse JSON fields (frontend will send FormData)
    const body = JSON.parse(req.body.data);

    // Extract uploaded files
    const files = req.files;
    const docMapper = (field) =>
      files[field]?.map((f) => ({
        fileName: f.originalname,
        filePath: f.path,
        size: f.size,
        uploadedAt: new Date(),
      })) || [];

    // Create vendor
    const vendor = await Vendor.create({
      ...body,
      vendor: req.user._id,
      user: req.user._id,
      name: req.user.firstName + " " + req.user.lastName,
      registrationStatus: "pending",
      submissionDate: new Date(),
      documents: {
        registrationCertificate: docMapper("registrationCertificate")[0] || null,
        businessLicense: docMapper("businessLicense")[0] || null,
        taxClearance: docMapper("taxClearance")[0] || null,
        vatRegistration: docMapper("vatRegistration")[0] || null,
        industryLicenses: docMapper("industryLicenses"),
        auditedStatements: docMapper("auditedStatements"),
        relevantExperience: docMapper("relevantExperience"),
        keyPersonnel: docMapper("keyPersonnel"),
        equipmentFacilities: docMapper("equipmentFacilities"),
        qualityCertifications: docMapper("qualityCertifications"),
        clientReferences: docMapper("clientReferences"),
        completedProjects: docMapper("completedProjects"),
        safetyRecords: docMapper("safetyRecords"),
        sustainabilityPractices: docMapper("sustainabilityPractices"),
        csrInitiatives: docMapper("csrInitiatives"),
        environmentCertificate: docMapper("environmentCertificate")[0] || null,
      },
    });

    // Run Pre-qualification scoring
    const preQualData = { ...body, companyInfo: body, legalCompliance: body, financialCapability: body, technicalCapacity: body, pastPerformance: body, hse: body, ethicsGovernance: body };
    const { score, status, reasons } = calculatePreQualScore(preQualData);

    await VendorPreQualification.create({
      vendorId: vendor._id,
      ...preQualData,
      score,
      status,
      reasons,
    });

    res.status(201).json({
      success: true,
      message: "Vendor registration submitted.",
      vendor,
      preQualification: { score, status, reasons },
    });
  } catch (err) {
    console.error("Error registering vendor:", err);
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
    const vendor = await User.findOne({ _id: req.user._id, role: 'Vendor' });

    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    res.json(vendor);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};




