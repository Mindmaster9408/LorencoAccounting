/* =============================================
   MOBILE UTILITIES
   Payroll App - Shared across all pages
   ============================================= */

const MobileUtils = {

    // Initialize all mobile features
    init: function() {
        this.setupHamburger();
        this.setupSwipeGestures();
        this.setupBottomNav();
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
    },

    // Hamburger menu toggle
    setupHamburger: function() {
        const hamburger = document.getElementById('mobile-hamburger');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobile-overlay');

        if (!hamburger || !sidebar) return;

        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            sidebar.classList.toggle('mobile-open');
            if (overlay) overlay.classList.toggle('active');

            // Update hamburger icon
            if (sidebar.classList.contains('mobile-open')) {
                hamburger.innerHTML = '<span style="font-size:20px;">✕</span>';
            } else {
                hamburger.innerHTML = '<span style="font-size:20px;">☰</span>';
            }
        });

        if (overlay) {
            overlay.addEventListener('click', function() {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
                hamburger.innerHTML = '<span style="font-size:20px;">☰</span>';
            });
        }

        // Close sidebar when clicking a nav link (mobile)
        sidebar.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('mobile-open');
                    if (overlay) overlay.classList.remove('active');
                    hamburger.innerHTML = '<span style="font-size:20px;">☰</span>';
                }
            });
        });
    },

    // Swipe gestures for sidebar
    setupSwipeGestures: function() {
        var startX = 0;
        var startY = 0;
        var tracking = false;

        document.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            tracking = true;
        }, { passive: true });

        document.addEventListener('touchend', function(e) {
            if (!tracking) return;
            tracking = false;

            var endX = e.changedTouches[0].clientX;
            var endY = e.changedTouches[0].clientY;
            var deltaX = endX - startX;
            var deltaY = Math.abs(endY - startY);

            // Only trigger if horizontal swipe is dominant
            if (Math.abs(deltaX) < 50 || deltaY > Math.abs(deltaX)) return;

            var sidebar = document.querySelector('.sidebar');
            var overlay = document.getElementById('mobile-overlay');
            var hamburger = document.getElementById('mobile-hamburger');

            if (!sidebar || window.innerWidth > 768) return;

            if (deltaX > 0 && startX < 40) {
                // Swipe right from edge - open sidebar
                sidebar.classList.add('mobile-open');
                if (overlay) overlay.classList.add('active');
                if (hamburger) hamburger.innerHTML = '<span style="font-size:20px;">✕</span>';
            } else if (deltaX < 0 && sidebar.classList.contains('mobile-open')) {
                // Swipe left - close sidebar
                sidebar.classList.remove('mobile-open');
                if (overlay) overlay.classList.remove('active');
                if (hamburger) hamburger.innerHTML = '<span style="font-size:20px;">☰</span>';
            }
        }, { passive: true });
    },

    // Bottom navigation - highlight current page
    setupBottomNav: function() {
        var currentPage = window.location.pathname.split('/').pop() || 'index.html';
        var navItems = document.querySelectorAll('.mobile-nav-item');

        navItems.forEach(function(item) {
            var href = item.getAttribute('href');
            if (href === currentPage) {
                item.classList.add('active');
            }
            // Also match dashboard variants
            if (currentPage === 'company-dashboard.html' && href === 'company-dashboard.html') {
                item.classList.add('active');
            }
        });
    },

    // Handle window resize
    handleResize: function() {
        var sidebar = document.querySelector('.sidebar');
        var overlay = document.getElementById('mobile-overlay');
        var hamburger = document.getElementById('mobile-hamburger');

        if (window.innerWidth > 768) {
            // Desktop - reset mobile states
            if (sidebar) sidebar.classList.remove('mobile-open');
            if (overlay) overlay.classList.remove('active');
            if (hamburger) hamburger.innerHTML = '<span style="font-size:20px;">☰</span>';
        }
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    MobileUtils.init();
});
