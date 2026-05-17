const crypto = require('crypto');
const fs = require('fs');

function computeHash(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

module.exports = { computeHash };
