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

  // ✅ Company Info
  checkField(preQualData.companyInfo?.registrationCertificate, "Registration Certificate");
  checkField(preQualData.companyInfo?.businessLicense, "Business License");
  checkField(preQualData.companyInfo?.address, "Company Address");
  checkField(preQualData.companyInfo?.contactEmail, "Contact Email");
  checkField(preQualData.companyInfo?.yearsInOperation, "Years in Operation");

  // ✅ Legal Compliance
  checkField(preQualData.legalCompliance?.taxClearance, "Tax Clearance");
  checkField(preQualData.legalCompliance?.vatRegistration, "VAT Registration");
  checkField(preQualData.legalCompliance?.industryLicenses?.length, "Industry Licenses");
  checkField(preQualData.legalCompliance?.laborLawCompliance, "Labor Law Compliance");
  checkField(preQualData.legalCompliance?.litigationHistory === false, "Litigation History (must be clean)");

  // ✅ Financial
  checkField(preQualData.financialCapability?.auditedStatements?.length, "Audited Statements");
  checkField(preQualData.financialCapability?.bankReference, "Bank Reference");
  checkField(preQualData.financialCapability?.insuranceCoverage, "Insurance Coverage");
  checkField(preQualData.financialCapability?.annualTurnover, "Annual Turnover");

  // ✅ Technical
  checkField(preQualData.technicalCapacity?.relevantExperience?.length, "Relevant Experience");
  checkField(preQualData.technicalCapacity?.keyPersonnel?.length, "Key Personnel");
  checkField(preQualData.technicalCapacity?.equipmentFacilities?.length, "Equipment/Facilities");
  checkField(preQualData.technicalCapacity?.qualityCertifications?.length, "Quality Certifications");
  checkField(preQualData.technicalCapacity?.deliveryCapacity, "Delivery Capacity");

  // ✅ Past Performance
  checkField(preQualData.pastPerformance?.clientReferences?.length, "Client References");
  checkField(preQualData.pastPerformance?.timelyDeliveryRecord, "Timely Delivery Record");
  checkField(preQualData.pastPerformance?.completedProjects?.length, "Completed Projects");
  checkField(preQualData.pastPerformance?.performanceRatings, "Performance Ratings");

  // ✅ HSE
  checkField(preQualData.hse?.safetyPolicy, "Safety Policy");
  checkField(preQualData.hse?.environmentCertificate, "Environment Certificate");
  checkField(preQualData.hse?.safetyRecords?.length, "Safety Records");
  checkField(preQualData.hse?.sustainabilityPractices?.length, "Sustainability Practices");

  // ✅ Ethics & Governance
  checkField(preQualData.ethicsGovernance?.antiCorruptionPolicy, "Anti-Corruption Policy");
  checkField(preQualData.ethicsGovernance?.conflictOfInterest === false, "No Conflict of Interest");
  checkField(preQualData.ethicsGovernance?.codeOfConductSigned, "Code of Conduct Signed");
  checkField(preQualData.ethicsGovernance?.csrInitiatives?.length, "CSR Initiatives");

  // Final score
  const score = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Status
  let status = "pending";
  if (score >= 70) status = "approved";
  else status = "rejected";

  return { score, status, reasons: missingReasons };
}

module.exports = calculatePreQualScore;
