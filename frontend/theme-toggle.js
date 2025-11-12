(function () {
  const body = document.body;

  // Initialize a single toggle
  function setToggleIcons(toggle) {
    const sunIcon = toggle.querySelector(".sun-icon");
    const moonIcon = toggle.querySelector(".moon-icon");
    if (!sunIcon || !moonIcon) return;

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      body.classList.add("dark-mode");
      sunIcon.style.display = "inline";
      moonIcon.style.display = "none";
    } else {
      body.classList.remove("dark-mode");
      sunIcon.style.display = "none";
      moonIcon.style.display = "inline";
    }

    // Add click listener for this toggle if not already added
    if (!toggle.dataset.listenerAdded) {
      toggle.addEventListener("click", () => {
        const isDark = body.classList.toggle("dark-mode");
        localStorage.setItem("theme", isDark ? "dark" : "light");
        sunIcon.style.display = isDark ? "inline" : "none";
        moonIcon.style.display = isDark ? "none" : "inline";
      });
      toggle.dataset.listenerAdded = "true";
    }
  }

  // Initialize all existing toggles
  function applyTheme() {
    const toggles = document.querySelectorAll(".dark-toggle");
    toggles.forEach(setToggleIcons);
  }

  // Run once DOM is ready
  document.addEventListener("DOMContentLoaded", applyTheme);

  // Watch for dynamically added toggles
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return; // Only element nodes
        const toggles = node.querySelectorAll(".dark-toggle");
        toggles.forEach(setToggleIcons);
        // Also check if the node itself is a toggle
        if (node.classList.contains("dark-toggle")) setToggleIcons(node);
      });
    });
  });

  observer.observe(body, { childList: true, subtree: true });
})();
