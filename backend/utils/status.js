// backend/utils/status.js
exports.getStatus = (book) => {
  if (book?.BHistorisiert) return 'historisiert';
  if (book?.BVorzeitig) return 'vorzeitig';
  return 'open';
};

// derive rank from trailing digits
exports.computeRank = (barcode /* '001' */) => {
  if (!barcode) return 0;
  if (barcode.endsWith('00')) return 2;
  if (barcode.endsWith('0')) return 1;
  return 0;
};
