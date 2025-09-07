const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const cheerio = require("cheerio");
require("dotenv").config();

// Middleware and Data Store
const authenticateJWT = require("./middleware/authenticateJWT.js");
const authorize = require("./middleware/authorize.js");
const { loadSubjects, saveSubjects } = require("./subjectStore");

// AI and OCR Dependencies
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Tesseract = require('tesseract.js');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURATION & MIDDLEWARE ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const SECRET = process.env.JWT_SECRET || "your-strong-secret-key";
let SUBJECTS_CONFIG = loadSubjects();

// --- FAKE USER DATABASE ---
const users = [
    { id: 1, username: "admin", password: bcrypt.hashSync("admin123", 8), role: "admin" },
    { id: 2, username: "user", password: bcrypt.hashSync("user123", 8), role: "user" }
];

// --- HELPER FUNCTION ---
function getLecturesData(subjectId) {
    if (!SUBJECTS_CONFIG[subjectId]) return { lectures: [], units: [] };
    const subject = SUBJECTS_CONFIG[subjectId];
    const lecturesFilePath = path.join(__dirname, "content", subjectId, "lectures.html");
    try {
        if (!fs.existsSync(lecturesFilePath) || !fs.readFileSync(lecturesFilePath, "utf-8").trim()) {
            return { lectures: [], units: subject.units.map(unit => ({ ...unit, lectures: [] })) };
        }
        const htmlContent = fs.readFileSync(lecturesFilePath, "utf-8");
        const $ = cheerio.load(htmlContent);
        const lectureList = [];
        const unitMap = Object.fromEntries(subject.units.map(u => [u.id, { ...u, lectures: [] }]));
        $(".lecture-content").each((i, elem) => {
            const lecture = {
                id: $(elem).attr("id"),
                title: $(elem).find("h2, h1").first().text(),
                unit: $(elem).attr("data-unit") || 'unit1'
            };
            lectureList.push(lecture);
            if (unitMap[lecture.unit]) unitMap[lecture.unit].lectures.push(lecture);
        });
        return { lectures: lectureList, units: Object.values(unitMap) };
    } catch (error) {
        console.error(`Error reading lectures for ${subjectId}:`, error);
        return { lectures: [], units: subject.units.map(unit => ({ ...unit, lectures: [] })) };
    }
}


// =============================
// 🔑 AUTH ROUTES
// =============================
app.get("/login", (req, res) => res.render("admin/login.ejs", { error: null }));
app.post("/login", (req, res) => {
    const user = users.find(u => u.username === req.body.username);
    if (!user || !bcrypt.compareSync(req.body.password, user.password)) {
        return res.status(401).render("admin/login.ejs", { error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: "1h" });
    res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.redirect("/admin");
});
app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});


// =============================
// 🔐 PROTECTED ADMIN ROUTES
// =============================
const adminAuth = [authenticateJWT, authorize("admin")];

app.get("/admin", adminAuth, (req, res) => res.render("admin/dashboard.ejs", { subjects: SUBJECTS_CONFIG }));

app.get("/admin/:subjectId", adminAuth, (req, res) => {
    const { subjectId } = req.params;
    if (!SUBJECTS_CONFIG[subjectId]) return res.status(404).send("Subject not found");
    res.render("admin/subject-dashboard.ejs", {
        subject: SUBJECTS_CONFIG[subjectId],
        subjectId: subjectId,
        units: SUBJECTS_CONFIG[subjectId].units
    });
});

const TEMP_DIR = path.join(__dirname, "temp");
fs.mkdirSync(TEMP_DIR, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// ADD NEW SUBJECT
app.post("/admin/add-subject", adminAuth, (req, res) => {
    const { subjectName, subjectCode } = req.body;
    const subjectId = subjectCode.toLowerCase();

    if (SUBJECTS_CONFIG[subjectId]) {
        return res.redirect("/admin?error=Subject code already exists");
    }

    const newUnits = [];
    for (let i = 1; i <= 6; i++) {
        newUnits.push({ id: `unit${i}`, title: `Unit ${i}` });
    }

    SUBJECTS_CONFIG[subjectId] = {
        name: subjectName,
        code: subjectCode,
        units: newUnits
    };

    saveSubjects(SUBJECTS_CONFIG);
    res.redirect("/admin");
});

// SHOW EDIT SUBJECT PAGE
app.get("/admin/edit-subject/:subjectId", adminAuth, (req, res) => {
    const { subjectId } = req.params;
    const subject = SUBJECTS_CONFIG[subjectId];
    if (!subject) {
        return res.redirect("/admin?error=Subject not found");
    }
    res.render("admin/edit-subject.ejs", { subject, subjectId });
});

// HANDLE EDIT SUBJECT FORM SUBMISSION
app.post("/admin/edit-subject/:subjectId", adminAuth, (req, res) => {
    const { subjectId } = req.params;
    const { subjectName, subjectCode } = req.body;

    if (SUBJECTS_CONFIG[subjectId]) {
        const updatedUnits = [];
        for (let i = 1; i <= 6; i++) {
            updatedUnits.push({
                id: `unit${i}`,
                title: req.body[`unit${i}_title`] || `Unit ${i}`
            });
        }
        
        SUBJECTS_CONFIG[subjectId].name = subjectName;
        SUBJECTS_CONFIG[subjectId].code = subjectCode;
        SUBJECTS_CONFIG[subjectId].units = updatedUnits;
        
        saveSubjects(SUBJECTS_CONFIG);
    }
    res.redirect("/admin");
});

// DELETE SUBJECT
app.post("/admin/delete-subject/:subjectId", adminAuth, (req, res) => {
    const { subjectId } = req.params;
    if (SUBJECTS_CONFIG[subjectId]) {
        delete SUBJECTS_CONFIG[subjectId];
        saveSubjects(SUBJECTS_CONFIG);
    }
    res.redirect("/admin");
});


app.post("/admin/:subjectId/upload", adminAuth, upload.single("pdfFile"), async (req, res) => {
    const { subjectId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const tempFilePath = req.file.path;
    const { title, unit } = req.body;
    
    try {
        const { convert } = require("pdf-poppler");
        const imageOutputPrefix = path.join(TEMP_DIR, `img-${Date.now()}`);
        const options = {
            format: 'png',
            out_dir: TEMP_DIR,
            out_prefix: path.basename(imageOutputPrefix),
            page: null
        };
        await convert(tempFilePath, options);
        
        let extractedText = "";
        const files = await fs.promises.readdir(TEMP_DIR);
        const imageFiles = files.filter(f => f.startsWith(path.basename(imageOutputPrefix))).sort((a, b) => {
            const pageA = parseInt(a.match(/-(\d+)\.png$/)[1]);
            const pageB = parseInt(b.match(/-(\d+)\.png$/)[1]);
            return pageA - pageB;
        });
        
        for (const imageFile of imageFiles) {
            const { data: { text } } = await Tesseract.recognize(path.join(TEMP_DIR, imageFile), 'eng');
            extractedText += text + '\n';
        }

        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const lectureId = title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const prompt = `Generate a self-contained HTML div for a lecture.
        - The root div must have id="${lectureId}" and class="lecture-content" and data-unit="${unit}".
        - Start with an <h1> tag for the title: ${title}.
        - Convert all mathematical notation to LaTeX.
        - Structure the content logically with h2, h3, p, ul, ol tags.
        - ONLY output the HTML div, nothing else.
        - Here is the text extracted from the PDF via OCR: \n\n${extractedText}`;

        const result = await model.generateContent(prompt);
        let htmlContent = result.response.text();
        htmlContent = htmlContent.replace(/^```html\n/, '').replace(/\n```$/, '');

        const lecturesFilePath = path.join(__dirname, "content", subjectId, "lectures.html");
        fs.mkdirSync(path.dirname(lecturesFilePath), { recursive: true });
        if (!fs.existsSync(lecturesFilePath)) fs.writeFileSync(lecturesFilePath, '');
        fs.appendFileSync(lecturesFilePath, `\n\n<!-- Lecture: ${title} -->\n${htmlContent}`);

        res.json({ success: true, message: `Lecture "${title}" added successfully!` });

    } catch (error) {
        console.error("Upload/OCR/AI Error:", error);
        res.status(500).json({ success: false, error: "Failed to process PDF." });
    } finally {
        const files = await fs.promises.readdir(TEMP_DIR);
        for (const file of files) {
            try {
                await fs.promises.unlink(path.join(TEMP_DIR, file));
            } catch (cleanupError) {
                console.error("Error during temp file cleanup:", cleanupError);
            }
        }
    }
});


// =============================
// 🚪 PUBLIC USER ROUTES
// =============================
app.get("/", (req, res) => {
    const subjectsWithStats = Object.keys(SUBJECTS_CONFIG).map(id => ({
        id, ...SUBJECTS_CONFIG[id], totalLectures: getLecturesData(id).lectures.length
    }));
    res.render("user/subjects.ejs", { subjects: subjectsWithStats });
});

app.get("/:subjectId", (req, res) => {
    const lecturesData = getLecturesData(req.params.subjectId);
    const firstLectureId = lecturesData.lectures.length > 0 ? lecturesData.lectures[0].id : 'welcome';
    res.redirect(`/${req.params.subjectId}/lectures/${firstLectureId}`);
});

app.get("/:subjectId/lectures/:lectureId", (req, res) => {
    const { subjectId, lectureId } = req.params;
    const subject = SUBJECTS_CONFIG[subjectId];
    if (!subject) return res.status(404).render("user/404.ejs", { message: "Subject not found" });

    const lecturesData = getLecturesData(subjectId);
    const lecturesFilePath = path.join(__dirname, "content", subjectId, "lectures.html");
    let currentLectureHtml = `<h2>Welcome to ${subject.name}</h2><p>No content available yet.</p>`;

    if (lectureId !== 'welcome' && fs.existsSync(lecturesFilePath)) {
        const $ = cheerio.load(fs.readFileSync(lecturesFilePath, "utf-8"));
        const lectureElement = $(`#${lectureId}`);
        currentLectureHtml = lectureElement.length > 0 ? lectureElement.html() : `<h2>Lecture Not Found</h2>`;
    }
    
    res.render("user/index.ejs", { subject, units: lecturesData.units, currentLectureId: lectureId, currentLectureHtml });
});


// =============================
// 🚀 START SERVER
// =============================
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

