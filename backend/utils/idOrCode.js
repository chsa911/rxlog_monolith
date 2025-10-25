// backend/utils/idOrCode.js
const { Types } = require("mongoose");

const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Turn an unknown identifier (ObjectId or human code) into a safe Mongo filter.
 * - If v is a valid ObjectId -> { _id: v }
 * - Otherwise -> { code: /^v$/i } (case-insensitive exact match)
 */
function idOrCodeQuery(v) {
  const s = String(v || "").trim();
  return Types.ObjectId.isValid(s)
    ? { _id: s }
    : { code: new RegExp(`^${escapeRx(s)}$`, "i") };
}

module.exports = { idOrCodeQuery, escapeRx };
