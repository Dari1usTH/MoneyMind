function updateNavbarForAdmin() {
    const ticketsNavItem = document.querySelector('.nav-links li a[href*="tickets"]')?.parentElement;
    const adminNavItem = document.querySelector('.nav-links li a[href*="admin"]')?.parentElement;
    if (!ticketsNavItem) return;
    
    fetch('http://localhost:3001/api/me', {
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        const isAdmin = data.success && data.user && data.user.username.toLowerCase().includes('admin');
        if (ticketsNavItem) {
            ticketsNavItem.style.display = isAdmin ? 'block' : 'none';
        }
    })
    .catch(err => {
        console.error('Error checking admin status:', err);
        if (ticketsNavItem) ticketsNavItem.style.display = 'none';
    });
}

document.addEventListener('DOMContentLoaded', updateNavbarForAdmin);