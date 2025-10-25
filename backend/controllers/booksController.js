// backend/controllers/booksController.js
const Book = require("../models/Book");
const Barcode = require("../models/Barcode");
const { getStatus, computeRank } = require("../utils/status");
const { sizeToPrefixFromDb } = require("../utils/sizeToPrefixFromDb");

const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;
const sevenDaysFromNow = () => new Date(Date.now() + MS_7_DAYS);

/* ------------------------- helpers ------------------------- */
function toNumberLoose(x) {
  if (typeof x === "number") return x;
  if (typeof x !== "string") return NaN;
  const s = x
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v)
    .trim()
    .replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
const safeRegExp = (s, flags = "i") => {
  const escaped = String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, flags);
};
const parseIntSafe = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const normEq = (field, lcValue) => ({
  $expr: {
    $eq: [{ $toLower: { $trim: { input: `$${field}` } } }, lcValue]
  }
});
const escapeRx = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Normalize DB docs → consistent API shape */
function normalizeBook(b) {
  const x = { ...b };

  // legacy numeric/page fields
  if (x.Bseiten != null && x.BSeiten == null) x.BSeiten = Number(x.Bseiten);
  if (typeof x.BBreite === "string") x.BBreite = toNum(x.BBreite);
  if (typeof x.BHoehe === "string") x.BHoehe = toNum(x.BHoehe);
  delete x.Bseiten;
  if (x["BEind*"] != null && x.BEind == null) delete x["BEind*"];

  // legacy text aliases → canonical fields
  if (!x.BAutor && typeof x.author === "string") x.BAutor = x.author;
  if (!x.BAutor && typeof x.Autor === "string") x.BAutor = x.Autor;
  if (!x.BTitel && typeof x.title === "string") x.BTitel = x.title;
  if (!x.BTitel && typeof x.Titel === "string") x.BTitel = x.Titel;

  if (!x.BVerlag && typeof x.publisher === "string") x.BVerlag = x.publisher;
  if (!x.BVerlag && typeof x.Verlag === "string") x.BVerlag = x.Verlag;

  // keyword family (keep BKw the primary)
  if (x.Bkw != null && x.BKw == null) x.BKw = x.Bkw;
  if (x.Bverlag != null && x.BVerlag == null) x.BVerlag = x.Bverlag;
  if (x.Bw1 != null && x.BKw1 == null) x.BKw1 = x.Bw1;
  delete x.Bkw;
  delete x.Bverlag;
  delete x.Bw1;

  // barcode mirror + convenience
  if (!x.BMarkb && x.barcode) x.BMarkb = x.barcode;
  if (!x.barcode && x.BMarkb) x.barcode = x.BMarkb;
  x.BMark = x.BMarkb || x.barcode || x.BMark || null;

  return x;
}

async function countCodeUsage(code) {
  if (!code) return 0;
  return Book.countDocuments({
    $or: [{ BMarkb: code }, { barcode: code }, { BMark: code }]
  });
}

/* ---------- alias + exact helpers (search) ---------- */
const FIELD_ALIASES = {
  BTitel: ["BTitel", "Titel", "title", "titleKeyword"],
  BAutor: ["BAutor", "Autor", "author"],
  BVerlag: ["BVerlag", "Bverlag", "Verlag", "publisher"],
  BKw: ["BKw", "Bkw", "keyword", "keywords", "titleKeyword"],
  BMarkb: ["BMarkb", "BMark", "mark", "barcode"]
};
function expandFieldAliases(keys) {
  const set = new Set();
  const source = keys && keys.length ? keys : Object.keys(FIELD_ALIASES);
  for (const k of source) (FIELD_ALIASES[k] || [k]).forEach(a => set.add(a));
  return Array.from(set);
}
function exactEqOrArrayClause(field, lcValue) {
  return {
    $or: [
      {
        $expr: {
          $eq: [{ $toLower: { $trim: { input: `$${field}` } } }, lcValue]
        }
      },
      {
        $expr: {
          $in: [
            lcValue,
            {
              $map: {
                input: { $cond: [{ $isArray: `$${field}` }, `$${field}`, []] },
                as: "v",
                in: { $toLower: { $trim: { input: "$$v" } } }
              }
            }
          ]
        }
      }
    ]
  };
}

/* ========================= LIST (SEARCH) ========================= */
async function listBooks(req, res) {
  try {
    console.log("[listBooks] query =", req.query);

    const {
      q,
      page = 1,
      limit = 20,
      sort,
      sortBy,
      order = "desc",
      createdFrom,
      createdTo,
      fields,
      onlyMarked,
      exact
    } = req.query;

    const safeRegExp = (s, flags = "i") => {
      const escaped = String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(escaped, flags);
    };
    const parseIntSafe = (v, d) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : d;
    };
    const normEq = (field, lc) => ({
      $expr: { $eq: [{ $toLower: { $trim: { input: `$${field}` } } }, lc] }
    });

    const pg = Math.max(1, parseIntSafe(page, 1));
    const lim = Math.min(200, Math.max(1, parseIntSafe(limit, 20)));
    const skip = (pg - 1) * lim;

    const SORT_WHITELIST = new Set([
      "BEind",
      "BSeiten",
      "BAutor",
      "BTitel",
      "BVerlag",
      "_id"
    ]);
    const direction = order === "asc" ? 1 : -1;
    const sortField = SORT_WHITELIST.has(String(sortBy || sort || "").trim())
      ? sortBy || sort
      : "BEind";

    const ALLOWED_TEXT_FIELDS = [
      "BTitel",
      "BAutor",
      "BVerlag",
      "BKw",
      "BMarkb",
      "titleKeyword",
      "keywords"
    ];
    const fieldsFromQuery = String(fields || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s => ALLOWED_TEXT_FIELDS.includes(s));

    const onlyMarkedFlag = ["1", "true", "yes", "on"].includes(
      String(onlyMarked || "").toLowerCase()
    );
    const exactFlag = ["1", "true", "yes", "on"].includes(
      String(exact || "").toLowerCase()
    );

    const filter = {};
    try {
      if (q && String(q).trim().length) {
        const cleaned = String(q).trim();
        const looksLikeBMark = /^[a-z]+[0-9]{2,}$/i.test(cleaned);
        const mRange = cleaned.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
        const mGte =
          cleaned.match(/^(?:>=\s*|)(\d+)\s*\+$/) ||
          cleaned.match(/^>=\s*(\d+)$/);
        const mLte =
          cleaned.match(/^<=\s*(\d+)$/) || cleaned.match(/^(\d+)\s*-[ ]*$/);
        const mEq = cleaned.match(/^\d+$/);

        if (looksLikeBMark || fieldsFromQuery.includes("BMarkb")) {
          const lc = cleaned.toLowerCase();
          const exactEq = field => ({
            $expr: {
              $eq: [
                { $toLower: { $trim: { input: { $toString: `$${field}` } } } },
                lc
              ]
            }
          });
          filter.$or = [
            exactEq("BMarkb"),
            exactEq("barcode"),
            exactEq("BMark")
          ];
        } else if (mRange || mGte || mLte || mEq) {
          const pageFields = ["BSeiten", "Bseiten"];
          const convInt = f => ({
            $convert: { input: `$${f}`, to: "int", onError: null, onNull: null }
          });
          const toText = f => ({ $toString: `$${f}` });
          const matchRange = f => ({
            $regexFind: { input: toText(f), regex: /(\d+)\s*[-–—]\s*(\d+)/ }
          });

          if (mRange) {
            const lo = Number(mRange[1]),
              hi = Number(mRange[2]);
            filter.$or = [
              ...pageFields.map(f => ({ [f]: { $gte: lo, $lte: hi } })),
              ...pageFields.map(f => ({
                $expr: {
                  $let: {
                    vars: { m: matchRange(f) },
                    in: {
                      $and: [
                        { $ne: ["$$m", null] },
                        {
                          $lte: [
                            { $toInt: { $arrayElemAt: ["$$m.captures", 0] } },
                            hi
                          ]
                        },
                        {
                          $gte: [
                            { $toInt: { $arrayElemAt: ["$$m.captures", 1] } },
                            lo
                          ]
                        }
                      ]
                    }
                  }
                }
              })),
              ...pageFields.map(f => ({
                $expr: {
                  $and: [
                    {
                      $regexMatch: {
                        input: toText(f),
                        regex: /^\s*(\d+)\s*\+$/
                      }
                    },
                    {
                      $lte: [
                        lo,
                        {
                          $toInt: {
                            $replaceAll: {
                              input: toText(f),
                              find: "+",
                              replacement: ""
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              }))
            ];
          } else if (mGte) {
            const x = Number(mGte[1]);
            filter.$or = [
              ...pageFields.map(f => ({ [f]: { $gte: x } })),
              ...pageFields.map(f => ({ $expr: { $gte: [convInt(f), x] } })),
              ...pageFields.map(f => ({
                $expr: {
                  $and: [
                    {
                      $regexMatch: {
                        input: toText(f),
                        regex: /^\s*(\d+)\s*\+$/
                      }
                    },
                    {
                      $gte: [
                        {
                          $toInt: {
                            $replaceAll: {
                              input: toText(f),
                              find: "+",
                              replacement: ""
                            }
                          }
                        },
                        x
                      ]
                    }
                  ]
                }
              })),
              ...pageFields.map(f => ({
                $expr: {
                  $let: {
                    vars: { m: matchRange(f) },
                    in: {
                      $and: [
                        { $ne: ["$$m", null] },
                        {
                          $gte: [
                            { $toInt: { $arrayElemAt: ["$$m.captures", 1] } },
                            x
                          ]
                        }
                      ]
                    }
                  }
                }
              }))
            ];
          } else if (mLte) {
            const x = Number(mLte[1]);
            filter.$or = [
              ...pageFields.map(f => ({ [f]: { $lte: x } })),
              ...pageFields.map(f => ({ $expr: { $lte: [convInt(f), x] } })),
              ...pageFields.map(f => ({
                $expr: {
                  $let: {
                    vars: { m: matchRange(f) },
                    in: {
                      $and: [
                        { $ne: ["$$m", null] },
                        {
                          $lte: [
                            { $toInt: { $arrayElemAt: ["$$m.captures", 0] } },
                            x
                          ]
                        }
                      ]
                    }
                  }
                }
              }))
            ];
          } else {
            const x = Number(cleaned);
            filter.$or = [
              ...pageFields.map(f => ({ [f]: x })),
              ...pageFields.map(f => ({ $expr: { $eq: [convInt(f), x] } })),
              ...pageFields.map(f => ({
                $expr: {
                  $let: {
                    vars: { m: matchRange(f) },
                    in: {
                      $and: [
                        { $ne: ["$$m", null] },
                        {
                          $lte: [
                            { $toInt: { $arrayElemAt: ["$$m.captures", 0] } },
                            x
                          ]
                        },
                        {
                          $gte: [
                            { $toInt: { $arrayElemAt: ["$$m.captures", 1] } },
                            x
                          ]
                        }
                      ]
                    }
                  }
                }
              })),
              ...pageFields.map(f => ({
                $expr: {
                  $and: [
                    {
                      $regexMatch: {
                        input: toText(f),
                        regex: /^\s*(\d+)\s*\+$/
                      }
                    },
                    {
                      $lte: [
                        x,
                        {
                          $toInt: {
                            $replaceAll: {
                              input: toText(f),
                              find: "+",
                              replacement: ""
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              }))
            ];
          }
        } else {
          const _requested = fieldsFromQuery.length
            ? fieldsFromQuery
            : [
                "BTitel",
                "BAutor",
                "BVerlag",
                "BKw",
                "BMarkb",
                "titleKeyword",
                "keywords"
              ];

          const exactRequested = exactFlag || fieldsFromQuery.length > 0;
          const textFields = _requested.flatMap(k => {
            if (k === "BTitel") return ["BTitel", "title", "titleKeyword"];
            if (k === "BKw")
              return ["BKw", "keyword", "keywords", "titleKeyword"];
            return [k];
          });

          if (exactRequested) {
            const lc = cleaned.toLowerCase();
            filter.$or = textFields.map(f => ({
              $or: [
                {
                  $expr: {
                    $eq: [{ $toLower: { $trim: { input: `$${f}` } } }, lc]
                  }
                },
                {
                  $expr: {
                    $in: [
                      lc,
                      {
                        $map: {
                          input: {
                            $cond: [{ $isArray: `$${f}` }, `$${f}`, []]
                          },
                          as: "v",
                          in: { $toLower: { $trim: { input: "$$v" } } }
                        }
                      }
                    ]
                  }
                }
              ]
            }));
          } else {
            const rx = safeRegExp(cleaned, "i");
            filter.$or = textFields.map(f => ({ [f]: rx }));
          }
        }
      } else if (createdFrom || createdTo) {
        const fromDate = createdFrom
          ? new Date(createdFrom + "T00:00:00.000Z")
          : null;
        const toDate = createdTo
          ? new Date(createdTo + "T23:59:59.999Z")
          : null;
        if ((fromDate && isNaN(fromDate)) || (toDate && isNaN(toDate))) {
          return res
            .status(400)
            .json({ error: "Invalid date format for createdFrom/createdTo" });
        }
        filter.BEind = {};
        if (fromDate) filter.BEind.$gte = fromDate;
        if (toDate) filter.BEind.$lt = toDate;
      }
    } catch (e) {
      console.error(
        "[listBooks] filter-build error:",
        e && (e.stack || e.message || e)
      );
      return res
        .status(400)
        .json({
          error: "Invalid search parameters",
          message: e.message || String(e)
        });
    }

    if (
      ["1", "true", "yes", "on"].includes(
        String(onlyMarked || "").toLowerCase()
      )
    ) {
      const guard = {
        $or: [
          { BMarkb: { $exists: true, $type: "string", $ne: "" } },
          { barcode: { $exists: true, $type: "string", $ne: "" } },
          { BMark: { $exists: true, $type: "string", $ne: "" } }
        ]
      };
      if (filter.$or) {
        const orBlock = filter.$or;
        delete filter.$or;
        filter.$and = (filter.$and || []).concat([{ $or: orBlock }, guard]);
      } else if (filter.$and) {
        filter.$and.push(guard);
      } else {
        Object.assign(filter, guard);
      }
    }

    const [items, total] = await Promise.all([
      Book.find(filter)
        .sort({ [sortField]: direction, _id: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      Book.countDocuments(filter)
    ]);

    const data = items.map(b => normalizeBook({ ...b, status: getStatus(b) }));
    res.json({
      data,
      page: pg,
      limit: lim,
      total,
      pages: Math.ceil(total / lim)
    });
  } catch (err) {
    console.error("listBooks error:", err && (err.stack || err.message || err));
    const msg = String(err?.message || "").toLowerCase();
    if (
      msg.includes("regexp") ||
      msg.includes("cast") ||
      msg.includes("invalid")
    ) {
      return res.status(400).json({ error: err.message || "Bad request" });
    }
    const body = { error: "Server error" };
    if (process.env.NODE_ENV !== "production")
      body.message = err.message || String(err);
    res.status(500).json(body);
  }
}

/* ========================= REGISTER (POST /api/books/register) ========================= */
async function registerBook(req, res) {
  const rawBreite = req.body.BBreite ?? req.body.width ?? req.body.breite;
  const rawHoehe = req.body.BHoehe ?? req.body.height ?? req.body.hoehe;
  const width = toNumberLoose(rawBreite);
  const height = toNumberLoose(rawHoehe);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return res
      .status(400)
      .json({
        error: "Invalid dimensions",
        details: { BBreite: rawBreite, BHoehe: rawHoehe }
      });
  }

  // local helpers
  const fallbackItoIK = prefix => {
    const m = /^(e|l|o)(.+)$/i.exec(prefix || "");
    if (!m) return null;
    const colour = m[2];
    if (colour.endsWith("ik")) return null;
    if (!colour.endsWith("i")) return null;
    return `${m[1]}${colour}k`;
  };

  try {
    const { BBreite, BHoehe, ...fields } = req.body;
    const w = width,
      h = height;

    // size → series
    let prefix;
    try {
      prefix = await sizeToPrefixFromDb(w, h);
    } catch (e) {
      console.error("sizeToPrefixFromDb failed:", e);
      return res.status(500).json({ error: "Size mapping error" });
    }
    if (!prefix) {
      console.warn("[registerBook] no prefix for", { w, h });
      return res
        .status(409)
        .json({ error: "No matching size rule", width: w, height: h });
    }

    const now = new Date();
    const primaryEsc = escapeRx(prefix);
    const altSeries = fallbackItoIK(prefix); // e.g. "ei" -> "eik" or null
    const allowedSeries = [prefix].concat(altSeries ? [altSeries] : []);
    const allowedSeriesRegexes = allowedSeries.map(
      p => new RegExp(`^${escapeRx(p)}$`, "i")
    );
    const seriesForCodeRx = new RegExp(
      `^(${allowedSeries.map(p => escapeRx(p)).join("|")})\\d+$`,
      "i"
    );

    // ensure uniqueness across books (defensive)
    const usedCodes = new Set([
      ...(await Book.distinct("BMarkb", {
        BMarkb: { $type: "string", $ne: "" }
      })),
      ...(await Book.distinct("barcode", {
        barcode: { $type: "string", $ne: "" }
      })),
      ...(await Book.distinct("BMark", { BMark: { $type: "string", $ne: "" } }))
    ]);

    // Client-supplied code (must match primary or fallback series, be available, and unused)
    const suppliedRaw = (fields.barcode || fields.BMarkb || fields.BMark || "")
      .toString()
      .trim();
    let picked = null;

    if (suppliedRaw) {
      if (!seriesForCodeRx.test(suppliedRaw)) {
        return res
          .status(400)
          .json({
            error: `Barcode "${suppliedRaw}" does not match expected series`,
            expectedSeries: allowedSeries
          });
      }

      const usedLc = new Set(
        Array.from(usedCodes).map(x => String(x).toLowerCase())
      );
      if (usedCodes.has(suppliedRaw) || usedLc.has(suppliedRaw.toLowerCase())) {
        return res
          .status(409)
          .json({
            error: `Barcode ${suppliedRaw} is already used by another book`
          });
      }

      picked = await Barcode.findOneAndUpdate(
        {
          series: { $in: allowedSeriesRegexes },
          code: new RegExp(`^${escapeRx(suppliedRaw)}$`, "i"),
          $or: [
            { isAvailable: true },
            { status: { $in: ["free", "available"] } }
          ]
        },
        { $set: { isAvailable: false, status: "reserved", reservedAt: now } },
        { new: true, returnDocument: "after" }
      ).lean();

      if (!picked) {
        return res
          .status(409)
          .json({
            error: `Barcode ${suppliedRaw} is not available in allowed series`,
            allowedSeries
          });
      }
    }

    // If not supplied, auto-pick (primary first, then fallback)
    if (!picked) {
      picked = await Barcode.findOneAndUpdate(
        {
          series: new RegExp(`^${primaryEsc}$`, "i"),
          code: { $nin: Array.from(usedCodes) },
          $or: [
            { isAvailable: true },
            { status: { $in: ["free", "available"] } }
          ]
        },
        { $set: { isAvailable: false, status: "reserved", reservedAt: now } },
        {
          sort: { rank: 1, triplet: 1, code: 1 },
          new: true,
          returnDocument: "after"
        }
      ).lean();

      if (!picked && altSeries) {
        const altEsc = escapeRx(altSeries);
        picked = await Barcode.findOneAndUpdate(
          {
            series: new RegExp(`^${altEsc}$`, "i"),
            code: { $nin: Array.from(usedCodes) },
            $or: [
              { isAvailable: true },
              { status: { $in: ["free", "available"] } }
            ]
          },
          { $set: { isAvailable: false, status: "reserved", reservedAt: now } },
          {
            sort: { rank: 1, triplet: 1, code: 1 },
            new: true,
            returnDocument: "after"
          }
        ).lean();
      }

      if (!picked) {
        console.warn(
          "[registerBook] no available barcode for series",
          prefix,
          "or fallback",
          altSeries
        );
        return res
          .status(409)
          .json({
            error: `No available barcode for series ${prefix}${
              altSeries ? ` (or ${altSeries})` : ""
            }`
          });
      }
    }

    // flags
    if (typeof fields.BHVorV === "string") {
      const val = fields.BHVorV.trim().toUpperCase();
      if (val === "H" || val === "V") {
        fields.BHVorV = val;
        fields.BHVorVAt = new Date();
        fields.BMarkReleaseDue = sevenDaysFromNow();
      } else if (val === "") {
        delete fields.BHVorV;
      } else {
        return res.status(400).json({ error: "BHVorV must be H or V" });
      }
    }
    if (typeof fields.BTop !== "undefined") {
      fields.BTop = !!fields.BTop;
      fields.BTopAt = fields.BTop ? new Date() : null;
    }

    // required/defaults
    fields.BAutor = (fields.BAutor ?? "").toString().trim() || "Unbekannt";
    fields.BKw = (fields.BKw ?? "").toString().trim() || "Allgemein";
    fields.BVerlag = (fields.BVerlag ?? "").toString().trim() || "Unbekannt";
    fields.BKP = Number.isFinite(Number(fields.BKP)) ? Number(fields.BKP) : 0;
    fields.BSeiten = Number.isFinite(Number(fields.BSeiten))
      ? Number(fields.BSeiten)
      : 0;

    // Create book with the chosen code
    let created;
    try {
      created = await Book.create({
        BBreite: w,
        BHoehe: h,
        ...fields,
        BMarkb: picked.code,
        barcode: picked.code
      });
    } catch (e) {
      await Barcode.updateOne(
        { _id: picked._id },
        {
          $set: {
            isAvailable: true,
            status: "available",
            reservedAt: null,
            assignedBookId: null
          }
        }
      );
      throw e;
    }

    // backlink (informational)
    await Barcode.updateOne(
      { _id: picked._id },
      { $set: { assignedBookId: created._id } }
    );

    const payload = normalizeBook({
      _id: created._id,
      BBreite: created.BBreite,
      BHoehe: created.BHoehe,
      barcode: picked.code,
      BMarkb: picked.code,
      BAutor: created.BAutor,
      BKw: created.BKw,
      BVerlag: created.BVerlag,
      BSeiten: created.BSeiten
    });
    console.log("[registerBook] OK", {
      _id: payload._id,
      barcode: payload.barcode
    });

    return res.status(201).json(payload);
  } catch (err) {
    console.error("registerBook error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}

/* ========================= GET ONE (GET /api/books/:id) ========================= */
async function getBook(req, res) {
  try {
    const { id } = req.params;
    const book = await Book.findById(id).lean();
    if (!book) return res.status(404).json({ error: "Book not found" });
    res.json({ ...normalizeBook(book), status: getStatus(book) });
  } catch (err) {
    console.error("getBook error:", err);
    res.status(400).json({ error: "Bad request" });
  }
}

/* ========================= UPDATE (PATCH /api/books/:id) ========================= */
async function updateBook(req, res) {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.BBreite != null) body.BBreite = toNum(body.BBreite);
    if (body.BHoehe != null) body.BHoehe = toNum(body.BHoehe);

    if (typeof body.BTop === "boolean") {
      if (body.BTop === true) body.BTopAt = new Date();
      else delete body.BTopAt;
    }
    if (body.BHVorV === "H" || body.BHVorV === "V") {
      body.BHVorVAt = new Date();
      body.BMarkReleaseDue = sevenDaysFromNow();
    }

    const updated = await Book.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ error: "Book not found" });

    try {
      if (typeof computeRank === "function") {
        const newRank = computeRank(updated);
        if (typeof newRank === "number" && newRank !== updated.rank) {
          updated.rank = newRank;
          await updated.save();
        }
      }
    } catch (_) {}

    res.json({
      ...normalizeBook(updated.toObject()),
      status: getStatus(updated)
    });
  } catch (err) {
    console.error("updateBook error:", err);
    res.status(400).json({ error: err.message || "Bad request" });
  }
}

/* ========================= DELETE (DELETE /api/books/:id) ========================= */
async function deleteBook(req, res) {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ error: "Book not found" });

    const code = book.BMarkb || book.barcode || book.BMark || null;
    await Book.findByIdAndDelete(id);

    let freed = false;
    let remaining = 0;
    if (code) {
      remaining = await countCodeUsage(code);
      if (remaining === 0) {
        await Barcode.updateOne(
          { code },
          {
            $set: {
              isAvailable: true,
              status: "available",
              reservedAt: null,
              assignedBookId: null
            }
          }
        );
        freed = true;
      }
    }

    res.json({
      ok: true,
      deletedId: id,
      code: code || null,
      freed,
      stillReferencedBy: remaining
    });
  } catch (err) {
    console.error("deleteBook error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

/* ========================= AUTOCOMPLETE (GET /api/books/autocomplete/:field) ========================= */
async function autocomplete(req, res) {
  try {
    const field = req.params.field || req.query.field;
    const { q } = req.query;

    const ALLOWED = new Set(["BAutor", "BKw", "BVerlag"]);
    if (!ALLOWED.has(field))
      return res.status(400).json({ error: "Invalid field" });
    if (!q || String(q).trim().length < 1) return res.json([]);

    const rx = safeRegExp(String(q).trim(), "i");
    const docs = await Book.aggregate([
      { $match: { [field]: rx } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 20 }
    ]);

    res.json(docs.map(d => d._id).filter(Boolean));
  } catch (err) {
    console.error("autocomplete error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

/* ------------------------- exports ------------------------- */
module.exports = {
  listBooks,
  registerBook,
  getBook,
  updateBook,
  deleteBook,
  autocomplete
};
