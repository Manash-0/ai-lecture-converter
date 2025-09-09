<<<<<<< HEAD
document.addEventListener("DOMContentLoaded", function() {
    // Accordion toggle for units
    document.querySelectorAll(".unit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const unit = btn.parentElement;
            unit.classList.toggle("open");
            const icon = btn.textContent.includes("▾") ? "▴" : "▾";
            btn.innerHTML = btn.textContent.replace(/[▾▴]/, icon);
        });
    });

    // Auto-open the unit containing the active lecture
    const activeLecture = document.querySelector('.lecture-link.active');
    if (activeLecture) {
        const parentUnit = activeLecture.closest('.unit');
        if (parentUnit) {
            parentUnit.classList.add('open');
            const btn = parentUnit.querySelector('.unit-btn');
            if (btn) btn.innerHTML = btn.textContent.replace("▾", "▴");
        }
    }

    // --- EDITED THEME TOGGLE LOGIC ---
    const toggleBtn = document.getElementById("theme-toggle");
    if (toggleBtn) {
        // On page load, check localStorage and apply the correct theme
        if (localStorage.getItem("theme") === "dark") {
            document.body.classList.add("dark-theme");
            toggleBtn.textContent = "☀️"; // Sun icon for dark mode
        } else {
            toggleBtn.textContent = "🌙"; // Moon icon for light mode
        }

        // When the button is clicked, toggle the theme
        toggleBtn.addEventListener("click", () => {
            document.body.classList.toggle("dark-theme");

            // Check which theme is active and save it to localStorage
            if (document.body.classList.contains("dark-theme")) {
                localStorage.setItem("theme", "dark");
                toggleBtn.textContent = "☀️";
            } else {
                localStorage.setItem("theme", "light");
                toggleBtn.textContent = "🌙";
            }
        });
    }
});
=======
document.addEventListener("DOMContentLoaded", function() {
    // Accordion toggle for units
    document.querySelectorAll(".unit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const unit = btn.parentElement;
            unit.classList.toggle("open");
            const icon = btn.textContent.includes("▾") ? "▴" : "▾";
            btn.innerHTML = btn.textContent.replace(/[▾▴]/, icon);
        });
    });

    // Auto-open the unit containing the active lecture
    const activeLecture = document.querySelector('.lecture-link.active');
    if (activeLecture) {
        const parentUnit = activeLecture.closest('.unit');
        if (parentUnit) {
            parentUnit.classList.add('open');
            const btn = parentUnit.querySelector('.unit-btn');
            if (btn) btn.innerHTML = btn.textContent.replace("▾", "▴");
        }
    }

    // --- EDITED THEME TOGGLE LOGIC ---
    const toggleBtn = document.getElementById("theme-toggle");
    if (toggleBtn) {
        // On page load, check localStorage and apply the correct theme
        if (localStorage.getItem("theme") === "dark") {
            document.body.classList.add("dark-theme");
            toggleBtn.textContent = "☀️"; // Sun icon for dark mode
        } else {
            toggleBtn.textContent = "🌙"; // Moon icon for light mode
        }

        // When the button is clicked, toggle the theme
        toggleBtn.addEventListener("click", () => {
            document.body.classList.toggle("dark-theme");

            // Check which theme is active and save it to localStorage
            if (document.body.classList.contains("dark-theme")) {
                localStorage.setItem("theme", "dark");
                toggleBtn.textContent = "☀️";
            } else {
                localStorage.setItem("theme", "light");
                toggleBtn.textContent = "🌙";
            }
        });
    }
});
>>>>>>> 5727652b69a5727bc4026541f31d5c71089e0237
