// Component loader for reusable HTML components
class ComponentLoader {
  static async loadComponent(componentPath, targetElementId) {
    try {
      const response = await fetch(componentPath);
      const html = await response.text();
      const targetElement = document.getElementById(targetElementId);
      if (targetElement) {
        targetElement.innerHTML = html;
      }
    } catch (error) {
      console.error('Error loading component:', error);
    }
  }

  static loadHeader() {
    const path = window.location.pathname;
    const isAuthPage = /\/login\.html$|\/signup\.html$/.test(path);
    const isDashboard = /\/dashboard\.html$|\/activity\.html$/.test(path);
    const headerFile = isDashboard
      ? 'components/header-dashboard.html'
      : (isAuthPage ? 'components/header-auth.html' : 'components/header.html');
    this.loadComponent(headerFile, 'header-container');
  }
}

// Auto-load header when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  ComponentLoader.loadHeader();
});
