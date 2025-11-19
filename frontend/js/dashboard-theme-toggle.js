 (function () {
   const body = document.body;
   const THEME_KEY = "theme";

   function updateToggleIcons(isDark) {
     const toggles = document.querySelectorAll(".dark-toggle");
     toggles.forEach((toggle) => {
       const sunIcon = toggle.querySelector(".sun-icon");
       const moonIcon = toggle.querySelector(".moon-icon");

       if (sunIcon) {
         sunIcon.style.display = isDark ? "inline" : "none";
       }
       if (moonIcon) {
         moonIcon.style.display = isDark ? "none" : "inline";
       }
     });
   }

   function applyTheme(theme) {
     const isDark = theme === "dark";
     body.classList.toggle("dark-mode", isDark);
     updateToggleIcons(isDark);
   }

   function toggleTheme() {
     const isDark = !body.classList.contains("dark-mode");
     body.classList.toggle("dark-mode", isDark);
     localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
     updateToggleIcons(isDark);
   }

   function initToggle(toggle) {
     if (!toggle || toggle.dataset.dashboardToggleInit) return;
     toggle.addEventListener("click", (event) => {
       event.preventDefault();
       toggleTheme();
     });
     toggle.dataset.dashboardToggleInit = "true";
   }

   function scanToggles() {
     const toggles = document.querySelectorAll(".dark-toggle");
     toggles.forEach(initToggle);
     updateToggleIcons(body.classList.contains("dark-mode"));
   }

   function initializeTheme() {
     const savedTheme = localStorage.getItem(THEME_KEY) || "light";
     applyTheme(savedTheme);
     scanToggles();
   }

   if (document.readyState === "loading") {
     document.addEventListener("DOMContentLoaded", initializeTheme);
   } else {
     initializeTheme();
   }

   const observer = new MutationObserver((mutations) => {
     let shouldRescan = false;
     mutations.forEach((mutation) => {
       mutation.addedNodes.forEach((node) => {
         if (node.nodeType !== 1) return;
         if (node.classList && node.classList.contains("dark-toggle")) {
           shouldRescan = true;
         }
         if (!shouldRescan && node.querySelector && node.querySelector(".dark-toggle")) {
           shouldRescan = true;
         }
       });
     });

     if (shouldRescan) {
       scanToggles();
     }
   });

   observer.observe(body, { childList: true, subtree: true });
 })();

