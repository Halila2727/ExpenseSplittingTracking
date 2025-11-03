// Component loader for reusable HTML components
class ComponentLoader {
  static async loadComponent(componentPath, targetElementId) {
    try {
      const response = await fetch(componentPath);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const targetElement = document.getElementById(targetElementId);
      
      if (targetElement) {
        targetElement.innerHTML = html;
        
        // Fix navigation links after header loads
        if (targetElementId === 'header-container') {
          this.fixNavigationLinks();
        }
      } else {
        console.error('Target element not found:', targetElementId);
      }
    } catch (error) {
      console.error('Error loading component:', error);
    }
  }
  
  static fixNavigationLinks() {
    // Ensure subnav links are not overridden by header component
    const subnavLinks = document.querySelectorAll('.subnav-link');
    subnavLinks.forEach(link => {
      // Only fix links that don't have the correct href
      if (link.href && link.href.includes('activity.html') && !link.classList.contains('active')) {
        const linkText = link.textContent.trim();
        switch(linkText) {
          case 'Dashboard':
            link.href = 'dashboard.html';
            break;
          case 'Groups':
            link.href = 'groups.html';
            break;
          case 'Personal':
            link.href = 'personal.html';
            break;
        }
      }
    });
  }

  static loadHeader() {
    const filename = window.location.pathname.split('/').pop();
    
    const isAuthPage = /^(login|signup)\.html$/.test(filename);
    const isDashboard = /^(dashboard|activity|groups|personal|group-details)\.html$/.test(filename);
    
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
