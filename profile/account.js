const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

const openNewAccountBtn = document.getElementById('openNewAccountBtn');
    if (openNewAccountBtn) {
      openNewAccountBtn.addEventListener('click', () => {
        const modal = document.getElementById('newAccountModal');
        const backdrop = document.getElementById('modalBackdrop');
        if (modal && backdrop) {
          modal.classList.remove('hidden');
          backdrop.classList.remove('hidden');
        }
    });
}