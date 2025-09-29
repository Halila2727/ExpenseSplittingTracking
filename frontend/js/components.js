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
    this.loadComponent('components/header.html', 'header-container');
  }
}

// Auto-load header when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  ComponentLoader.loadHeader();
});
