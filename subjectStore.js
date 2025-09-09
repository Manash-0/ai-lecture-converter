// subjectStore.js
const fs = require("fs");
const path = require("path");

const subjectsFile = path.join(__dirname, "data", "subjects.json");

function loadSubjects() {
  try {
    const dataDir = path.dirname(subjectsFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(subjectsFile)) {
      fs.writeFileSync(subjectsFile, JSON.stringify({}, null, 2));
    }
    const data = fs.readFileSync(subjectsFile, "utf-8").trim();
    if (!data) return {};
    return JSON.parse(data);
  } catch (err) {
    console.error("Error loading subjects:", err);
    return {};
  }
}


function saveSubjects(subjects) {
  try {
    fs.writeFileSync(subjectsFile, JSON.stringify(subjects, null, 2));
  } catch (err) {
    console.error("Error saving subjects:", err);
  }
}

module.exports = { loadSubjects, saveSubjects };