document.addEventListener('DOMContentLoaded', function() {
    checkAdminAccess();
});

async function checkAdminAccess() {
    try {
        const isAdminInLocalStorage = localStorage.getItem('adminLoggedIn') === 'true';
        const userRole = localStorage.getItem('userRole');
        
        if (isAdminInLocalStorage && userRole === 'admin') {
            document.getElementById('adminContent').classList.remove('hidden');
            document.getElementById('accessDenied').classList.add('hidden');
            loadAdminTickets();
            setupAdminEventListeners();
            return;
        }

        const response = await fetch('http://localhost:3001/api/me', {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            showAccessDenied();
            return;
        }

        const data = await response.json();
        
        if (data.success && data.user && data.user.role === 'admin') {
            document.getElementById('adminContent').classList.remove('hidden');
            document.getElementById('accessDenied').classList.add('hidden');
            loadAdminTickets();
            setupAdminEventListeners();
        } else {
            showAccessDenied();
        }
    } catch (error) {
        console.error('Error checking admin access:', error);
        showAccessDenied();
    }
}

function showAccessDenied() {
    document.getElementById('accessDenied').classList.remove('hidden');
    document.getElementById('adminContent').classList.add('hidden');
}