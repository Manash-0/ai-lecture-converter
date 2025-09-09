const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Middleware and Models
const authenticateJWT = require("./middleware/authenticateJWT.js");
const authorize = require("./middleware/authorize.js");
const Subject = require("./models/subject.model.js");
const Lecture = require("./models/lecture.model.js");
const User = require("./models/user.model.js"); // Added User model

const app = express();
const PORT = process.env.PORT || 3001;

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB connected successfully.");
        seedAdminUser(); // Seed admin after connection
    })
    .catch(err => console.error("❌ MongoDB connection error:", err));

// --- ADMIN SEEDING ---
async function seedAdminUser() {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10);
            await User.create({
                username: "admin",
                passwordHash: passwordHash,
                role: "admin"
            });
            console.log("✅ Default admin user created successfully.");
        }
    } catch (error) {
        console.error("❌ Error seeding admin user:", error);
    }
}

// --- CONFIGURATION & MIDDLEWARE ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const SECRET = process.env.JWT_SECRET || "your-strong-secret-key";

// =============================
// 🔑 AUTH ROUTES
// =============================
app.get("/login", (req, res) => res.render("admin/login.ejs", { error: null }));
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
            return res.status(401).render("admin/login.ejs", { error: "Invalid credentials" });
        }
        const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, SECRET, { expiresIn: "1h" });
        res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.redirect("/admin");
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).render("admin/login.ejs", { error: "Server error during login." });
    }
});
app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});


// =============================
// 🔐 PROTECTED ADMIN ROUTES
// =============================
const adminAuth = [authenticateJWT, authorize("admin")];
const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Use memory storage as we send the buffer directly to the AI
const upload = multer({ storage: multer.memoryStorage() });

app.get("/admin", adminAuth, async (req, res) => {
    const subjects = await Subject.find().lean();
    res.render("admin/dashboard.ejs", { subjects });
});

app.post("/admin/add-subject", adminAuth, async (req, res) => {
    const { subjectName, subjectCode } = req.body;
    const newUnits = Array.from({ length: 6 }, (_, i) => ({ id: `unit${i + 1}`, title: `Unit ${i + 1}` }));
    const newSubject = new Subject({ name: subjectName, code: subjectCode, units: newUnits });
    await newSubject.save();
    res.redirect("/admin");
});

app.get("/admin/edit-subject/:subjectId", adminAuth, async (req, res) => {
    const subject = await Subject.findById(req.params.subjectId).lean();
    res.render("admin/edit-subject.ejs", { subject });
});

app.post("/admin/edit-subject/:subjectId", adminAuth, async (req, res) => {
    const { subjectName, subjectCode } = req.body;
    const updatedUnits = Array.from({ length: 6 }, (_, i) => ({
        id: `unit${i + 1}`,
        title: req.body[`unit${i + 1}_title`] || `Unit ${i + 1}`
    }));
    await Subject.findByIdAndUpdate(req.params.subjectId, {
        name: subjectName,
        code: subjectCode,
        units: updatedUnits
    });
    res.redirect("/admin");
});

app.get("/admin/:subjectCode", adminAuth, async (req, res) => {
    const subject = await Subject.findOne({ code: req.params.subjectCode }).lean();
    res.render("admin/subject-dashboard.ejs", { subject });
});

app.post("/admin/delete-subject/:subjectId", adminAuth, async (req, res) => {
    const subject = await Subject.findByIdAndDelete(req.params.subjectId);
    // Also delete associated lectures
    if (subject) {
        await Lecture.deleteMany({ subjectCode: subject.code });
    }
    res.redirect("/admin");
});

// REMOVED WORKER - Processing happens directly in this route
app.post("/admin/:subjectCode/upload", adminAuth, upload.single("pdfFile"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    try {
        const { title, unit } = req.body;
        const { subjectCode } = req.params;

        console.log(`Processing PDF "${title}" for subject ${subjectCode}...`);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const lectureId = title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const prompt = `You are an expert educator. Analyze the provided PDF and generate a detailed, self-contained HTML div for a lecture. 
        - The root div must have: id="${lectureId}", class="lecture-content", and data-unit="${unit}".
        - The main title must be in an <h1> tag: <h1>${title}</h1>
        - Convert all mathematical notations to LaTeX.
        - Structure the content logically with clear headings (h2, h3), paragraphs, and lists.
        - Your entire output must be ONLY the HTML div, with no extra text or markdown.`;
        
        const filePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: "application/pdf",
            },
        };
        
        const result = await model.generateContent([prompt, filePart]);
        let htmlContent = result.response.text();
        htmlContent = htmlContent.replace(/^```html\n/, '').replace(/\n```$/, '');

        // Save new lecture to MongoDB
        const newLecture = new Lecture({
            title,
            lectureId,
            subjectCode,
            unitId: unit,
            htmlContent,
        });
        await newLecture.save();
        
        console.log(`Successfully processed and saved lecture to DB: ${title}`);
        res.json({ success: true, message: `Lecture "${title}" generated and saved successfully!` });

    } catch (error) {
        console.error("Direct Upload/AI Error:", error);
        res.status(500).json({ success: false, error: "Failed to process PDF with AI." });
    }
});


// =============================
// 🚪 PUBLIC USER ROUTES
// =============================
app.get("/", async (req, res) => {
    const subjects = await Subject.find().select('name code').lean();
    const subjectsWithStats = await Promise.all(subjects.map(async (s) => {
        const count = await Lecture.countDocuments({ subjectCode: s.code });
        return { ...s, totalLectures: count };
    }));
    res.render("user/subjects.ejs", { subjects: subjectsWithStats });
});

app.get("/:subjectCode", async (req, res) => {
    const firstLecture = await Lecture.findOne({ subjectCode: req.params.subjectCode }).sort({ createdAt: 1 }).lean();
    const lectureId = firstLecture ? firstLecture.lectureId : 'welcome';
    res.redirect(`/${req.params.subjectCode}/lectures/${lectureId}`);
});

app.get("/:subjectCode/lectures/:lectureId", async (req, res) => {
    const { subjectCode, lectureId } = req.params;
    const subject = await Subject.findOne({ code: subjectCode }).lean();
    if (!subject) return res.status(404).render("user/404.ejs", { message: "Subject not found" });

    const allLectures = await Lecture.find({ subjectCode: subjectCode }).select('title lectureId unitId').lean();
    
    const units = subject.units.map(unit => ({
        ...unit,
        lectures: allLectures.filter(l => l.unitId === unit.id)
    }));
    
    let currentLectureHtml = `<h2>Welcome to ${subject.name}</h2><p>Select a lecture from the sidebar to begin.</p>`;
    if (lectureId !== 'welcome') {
        const currentLecture = await Lecture.findOne({ lectureId: lectureId, subjectCode: subjectCode }).lean();
        currentLectureHtml = currentLecture ? currentLecture.htmlContent : "<h2>Lecture Not Found</h2>";
    }
    
    res.render("user/index.ejs", { subject, units, currentLectureId: lectureId, currentLectureHtml });
});


// =============================
// 🚀 START SERVER
// =============================
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

