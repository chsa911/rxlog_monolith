const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    BBreite: { type: Number, required: true },
    BHoehe: { type: Number, required: true },
    BAutor: { type: String, required: true },
    BKw: { type: String, required: true, maxlength: 25 },
    BKP: { type: Number, required: true, max: 2 },
    BKw1: { type: String, maxlength: 25 },
    BK1P: { type: Number, max: 2 },
    BKw2: { type: String, maxlength: 25 },
    BK2P: { type: Number, max: 2 },
    BVerlag: { type: String, required: true, maxlength: 25 },
    BSeiten: { type: Number, required: true },
    BEind: { type: Date, default: Date.now },
    BTop: { type: Boolean, default: false },
    BMarkb: { type: String, default: null },
    BMarkf: { type: [String], default: [] },
    BErg: { type: Date, default: null }
});

module.exports = mongoose.model('Book', bookSchema);
