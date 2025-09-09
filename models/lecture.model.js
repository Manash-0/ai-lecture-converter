const mongoose = require('mongoose');

const lectureSchema = new mongoose.Schema({
    title: { type: String, required: true },
    lectureId: { type: String, required: true, unique: true }, // e.g., 'introduction-to-calculus'
    subjectCode: { type: String, required: true, uppercase: true },
    unitId: { type: String, required: true },
    htmlContent: { type: String, required: true },
}, { timestamps: true });

const Lecture = mongoose.model('Lecture', lectureSchema);

module.exports = Lecture;
