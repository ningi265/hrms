const VendorPreQualification = require("../../models/vendorPreQualification");
const calculatePreQualScore = require("../../utils/scoreCalculator");

// ✅ Create
exports.createPreQualification = async (req, res) => {
  console.log("Request Body:", req.body);
  try {
    const { score, status, reasons } = calculatePreQualScore(req.body);
    console.log("Calculated Score:", score, "Status:", status, "Reasons:", reasons);

    const preQual = new VendorPreQualification({
      ...req.body,
      score,
      status,
    });

    await preQual.save();

    res.status(201).json({
      success: true,
      data: preQual,
      message: `Prequalification ${status}. Score: ${score}%.`,
      reasons: status === "rejected" ? reasons : [],
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};


// ✅ Get All
exports.getAllPreQualifications = async (req, res) => {
  try {
    const preQuals = await VendorPreQualification.find().populate("vendorId");
    res.status(200).json({ success: true, data: preQuals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get By Vendor ID
exports.getPreQualificationByVendor = async (req, res) => {
  try {
    const preQual = await VendorPreQualification.findOne({
      vendorId: req.params.vendorId,
    }).populate("vendorId");

    if (!preQual) {
      return res.status(404).json({
        success: false,
        message: "Pre-qualification not found",
      });
    }

    res.status(200).json({ success: true, data: preQual });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Update
exports.updatePreQualification = async (req, res) => {
  console.log("Update Body:", req.body);
  try {
    const { score, status, reasons } = calculatePreQualScore(req.body);
    console.log("Updated Score:", score, "Status:", status, "Reasons:", reasons);

    const updatedPreQual = await VendorPreQualification.findByIdAndUpdate(
      req.params.id,
      { ...req.body, score, status },
      { new: true, runValidators: true }
    );

    if (!updatedPreQual) {
      return res.status(404).json({
        success: false,
        message: "Pre-qualification not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedPreQual,
      message: `Prequalification ${status}. Score: ${score}%.`,
      reasons: status === "rejected" ? reasons : [],
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};




// ✅ Delete
exports.deletePreQualification = async (req, res) => {
  try {
    const deletedPreQual = await VendorPreQualification.findByIdAndDelete(
      req.params.id
    );

    if (!deletedPreQual) {
      return res.status(404).json({
        success: false,
        message: "Pre-qualification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Pre-qualification deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ✅ Get Approved Vendors
exports.getApprovedVendors = async (req, res) => {
  try {
    const approvedVendors = await VendorPreQualification.find({ status: "approved" })
      .populate("vendorId");

    res.status(200).json({ success: true, data: approvedVendors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
