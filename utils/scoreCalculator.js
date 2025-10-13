function calculatePreQualScore(preQualData) {
  let totalFields = 0;
  let filledFields = 0;
  let missingReasons = [];

  const checkField = (value, label) => {
    totalFields++;
    if (value !== null && value !== undefined && value !== "" && value !== false) {
      filledFields++;
    } else {
      missingReasons.push(`${label} is missing or invalid`);
    }
  };

  // ✅ FLAT APPROACH: Extract documents from the correct location
  const documents = preQualData.documents || {};
  
  // ✅ Company Info
  checkField(documents.registrationCertificate, "Registration Certificate");
  checkField(documents.businessLicense, "Business License");
  checkField(preQualData.companyInfo?.address, "Company Address");
  checkField(preQualData.companyInfo?.contactEmail, "Contact Email");
  checkField(preQualData.companyInfo?.yearsInOperation, "Years in Operation");

  // ✅ Legal Compliance
  checkField(documents.taxClearance, "Tax Clearance");
  checkField(documents.vatRegistration, "VAT Registration");
  checkField(documents.industryLicenses?.length > 0, "Industry Licenses");
  checkField(preQualData.legalCompliance?.laborLawCompliance, "Labor Law Compliance");
  checkField(preQualData.legalCompliance?.litigationHistory === false, "Litigation History (must be clean)");

  // ✅ Financial
  checkField(documents.auditedStatements?.length > 0, "Audited Statements");
  checkField(preQualData.financialCapability?.bankReference, "Bank Reference");
  checkField(preQualData.financialCapability?.insuranceCoverage, "Insurance Coverage");
  checkField(preQualData.financialCapability?.annualTurnover, "Annual Turnover");

  // ✅ Technical
  checkField(documents.relevantExperience?.length > 0, "Relevant Experience");
  checkField(documents.keyPersonnel?.length > 0, "Key Personnel");
  checkField(documents.equipmentFacilities?.length > 0, "Equipment/Facilities");
  checkField(documents.qualityCertifications?.length > 0, "Quality Certifications");
  checkField(preQualData.technicalCapacity?.deliveryCapacity, "Delivery Capacity");

  // ✅ Past Performance
  checkField(documents.clientReferences?.length > 0, "Client References");
  checkField(preQualData.pastPerformance?.timelyDeliveryRecord, "Timely Delivery Record");
  checkField(documents.completedProjects?.length > 0, "Completed Projects");
  checkField(preQualData.pastPerformance?.performanceRatings, "Performance Ratings");

  // ✅ HSE
  checkField(preQualData.hse?.safetyPolicy, "Safety Policy");
  checkField(documents.environmentCertificate, "Environment Certificate");
  checkField(documents.safetyRecords?.length > 0, "Safety Records");
  checkField(documents.sustainabilityPractices?.length > 0, "Sustainability Practices");

  // ✅ Ethics & Governance
  checkField(preQualData.ethicsGovernance?.antiCorruptionPolicy, "Anti-Corruption Policy");
  checkField(preQualData.ethicsGovernance?.conflictOfInterest === false, "No Conflict of Interest");
  checkField(preQualData.ethicsGovernance?.codeOfConductSigned, "Code of Conduct Signed");
  checkField(documents.csrInitiatives?.length > 0, "CSR Initiatives");

  // Final score
  const score = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Status
  let status = "pending";
  if (score >= 70) status = "approved";
  else if (score >= 50) status = "under_review";
  else status = "rejected";

  return { score, status, reasons: missingReasons };
}

module.exports = calculatePreQualScore;