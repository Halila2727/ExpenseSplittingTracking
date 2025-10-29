document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  const body = document.body;
  const toggles = document.querySelectorAll(".dark-toggle");

  const isDark = savedTheme === "dark";
  body.classList.toggle("dark-mode", isDark);

  toggles.forEach(toggle => {
    const sunIcon = toggle.querySelector(".sun-icon");
    const moonIcon = toggle.querySelector(".moon-icon");
    if (sunIcon && moonIcon) {
      sunIcon.style.display = isDark ? "inline" : "none";
      moonIcon.style.display = isDark ? "none" : "inline";
    }
  });
});

document.addEventListener("click", (e) => {
  const toggle = e.target.closest(".dark-toggle");
  if (!toggle) return;

  const body = document.body;
  const sunIcon = toggle.querySelector(".sun-icon");
  const moonIcon = toggle.querySelector(".moon-icon");

  const isDark = body.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  sunIcon.style.display = isDark ? "inline" : "none";
  moonIcon.style.display = isDark ? "none" : "inline";
});
