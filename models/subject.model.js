const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true }
});

const subjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    units: [unitSchema]
});

const Subject = mongoose.model('Subject', subjectSchema);

module.exports = Subject;
