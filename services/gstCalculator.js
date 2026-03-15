// GST calculator: splits CGST/SGST vs IGST based on branch and place of supply.
// Pure function, no DB access.
function calculateGST({ branchStateCode, placeOfSupplyStateCode, taxableValue, gstPercent, isInclusive = false }) {
  const rate = Number(gstPercent || 0);
  let base = Number(taxableValue || 0);

  if (isInclusive && rate > 0) {
    base = base / (1 + rate / 100);
  }

  const interstate = branchStateCode && placeOfSupplyStateCode && branchStateCode !== placeOfSupplyStateCode;
  const igstRate = interstate ? rate : 0;
  const cgstRate = interstate ? 0 : rate / 2;
  const sgstRate = interstate ? 0 : rate / 2;

  const cgstAmount = base * (cgstRate / 100);
  const sgstAmount = base * (sgstRate / 100);
  const igstAmount = base * (igstRate / 100);
  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const lineTotal = isInclusive ? Number(taxableValue || 0) : base + totalTax;

  return {
    taxableValue: base,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    lineTotal,
    interstate,
    appliedRates: { cgstRate, sgstRate, igstRate }
  };
}

module.exports = { calculateGST };
