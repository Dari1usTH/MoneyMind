const API_BASE = "http://localhost:3001";

let adminTickets = [];
let currentAdminTicketId = null;
let isInitialized = false;
let isRefreshing = false;

document.addEventListener('DOMContentLoaded', function() {
    checkAdminAccess();
});

async function checkAdminAccess() {
    if (isInitialized) return;
    
    try {
        const isAdminInLocalStorage = localStorage.getItem('adminLoggedIn') === 'true';
        const userRole = localStorage.getItem('userRole');
        
        if (isAdminInLocalStorage && userRole === 'admin') {
            showAdminContent();
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
            showAdminContent();
        } else {
            showAccessDenied();
        }
    } catch (error) {
        showAccessDenied();
    }
}

function showAdminContent() {
    document.getElementById('adminContent').classList.remove('hidden');
    document.getElementById('accessDenied').classList.add('hidden');
    isInitialized = true;
    initializeAdminPanel();
}

function showAccessDenied() {
    document.getElementById('accessDenied').classList.remove('hidden');
    document.getElementById('adminContent').classList.add('hidden');
}

function initializeAdminPanel() {
    setupAdminEventListeners();
    setupOnlineHandlers();
    loadAdminTickets();
}

function setupAdminEventListeners() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('.primary-ghost')) {
            e.preventDefault();
            refreshTickets();
        }
    });
    
    const replyTextarea = document.getElementById('adminReplyMessage');
    if (replyTextarea) {
        replyTextarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendAdminReply();
            }
        });
    }
}

function setupOnlineHandlers() {
    let onlineTimeout;
    
    window.addEventListener('online', function() {
        clearTimeout(onlineTimeout);
        onlineTimeout = setTimeout(() => {
            showNotification('Connection restored', 'success');
            loadAdminTickets();
        }, 1000);
    });
    
    window.addEventListener('offline', function() {
        clearTimeout(onlineTimeout);
        showNotification('You are offline', 'error');
    });
}

async function loadAdminTickets() {
    if (isRefreshing) return;
    
    try {
        showLoadingState();
        
        const statusFilter = document.getElementById('adminStatusFilter')?.value || 'all';
        const typeFilter = document.getElementById('adminTypeFilter')?.value || 'all';
        const priorityFilter = document.getElementById('adminPriorityFilter')?.value || 'all';
        
        let url = `${API_BASE}/api/admin/tickets`;
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (typeFilter !== 'all') params.append('type', typeFilter);
        if (priorityFilter !== 'all') params.append('priority', priorityFilter);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }

        const response = await fetch(url, {
            credentials: 'include'
        });
        const result = await response.json();

        if (response.ok && result.success) {
            adminTickets = result.tickets || [];
            displayAdminTickets();
            updateTicketStats();
            updateStatistics(adminTickets);
        } else {
            throw new Error(result.message || 'Failed to load tickets');
        }
    } catch (error) {
        showErrorState('Error loading tickets. Please refresh the page.');
    }
}

function showLoadingState() {
    const activeContainer = document.getElementById('activeTicketsList');
    const closedContainer = document.getElementById('closedTicketsList');
    
    if (activeContainer) {
        activeContainer.innerHTML = '<div class="loading-state">Loading active tickets...</div>';
    }
    if (closedContainer) {
        closedContainer.innerHTML = '<div class="loading-state">Loading closed tickets...</div>';
    }
}

function showErrorState(message) {
    const activeContainer = document.getElementById('activeTicketsList');
    const closedContainer = document.getElementById('closedTicketsList');
    
    const errorHTML = `
        <div class="empty-state">
            <div class="icon"></div>
            <div>${message}</div>
            <button class="primary-btn" onclick="loadAdminTickets()" style="margin-top: 16px;">Try Again</button>
        </div>
    `;
    
    if (activeContainer) activeContainer.innerHTML = errorHTML;
    if (closedContainer) closedContainer.innerHTML = errorHTML;
}

function displayAdminTickets() {
    const statusFilter = document.getElementById('adminStatusFilter')?.value || 'all';
    const typeFilter = document.getElementById('adminTypeFilter')?.value || 'all';
    const priorityFilter = document.getElementById('adminPriorityFilter')?.value || 'all';
    const sortFilter = document.getElementById('adminSortFilter')?.value || 'newest';
    
    let filteredTickets = adminTickets.filter(ticket => 
        (statusFilter === 'all' || ticket.status === statusFilter) &&
        (typeFilter === 'all' || ticket.type === typeFilter) &&
        (priorityFilter === 'all' || ticket.priority === priorityFilter)
    );

    const activeTickets = filteredTickets.filter(ticket => ticket.status !== 'closed');
    const closedTickets = filteredTickets.filter(ticket => ticket.status === 'closed');

    const sortTickets = (tickets) => {
        return tickets.sort((a, b) => {
            switch (sortFilter) {
                case 'oldest':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'priority':
                    const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                case 'updated':
                    return new Date(b.updated_at) - new Date(a.updated_at);
                default: 
                    return new Date(b.created_at) - new Date(a.created_at);
            }
        });
    };

    displayTicketsSection('activeTicketsList', sortTickets(activeTickets), 'active');
    displayTicketsSection('closedTicketsList', sortTickets(closedTickets), 'closed');
    updateTicketsCounters(activeTickets.length, closedTickets.length);
}

function updateStatistics(tickets) {
    const openTickets = tickets.filter(t => t.status === 'open').length;
    const urgentTickets = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed').length;
    const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
    
    const totalTicketsWithMessages = tickets.filter(t => t.message_count > 0).length;
    const responseRate = tickets.length > 0 ? Math.round((totalTicketsWithMessages / tickets.length) * 100) : 0;
    
    const openElement = document.getElementById('openTicketsCount');
    const urgentElement = document.getElementById('urgentTicketsCount');
    const progressElement = document.getElementById('inProgressCount');
    const rateElement = document.getElementById('responseRate');
    
    if (openElement) openElement.textContent = openTickets;
    if (urgentElement) urgentElement.textContent = urgentTickets;
    if (progressElement) progressElement.textContent = inProgressTickets;
    if (rateElement) rateElement.textContent = `${responseRate}%`;
}

function getTicketRowClass(ticket) {
    if (ticket.priority === 'urgent') return 'urgent';
    if (ticket.status === 'open' && hasUnreadMessages(ticket)) return 'unread';
    return '';
}

function hasUnreadMessages(ticket) {
    return (ticket.unread_count || 0) > 0;
}

function filterAdminTickets() {
    loadAdminTickets();
}

function updateTicketStats() {
    const openTickets = adminTickets.filter(t => t.status === 'open').length;
    const inProgressTickets = adminTickets.filter(t => t.status === 'in_progress').length;
    const urgentTickets = adminTickets.filter(t => t.priority === 'urgent' && t.status !== 'closed').length;
    
    const statsElement = document.getElementById('ticketStats');
    if (statsElement) {
        statsElement.textContent = 
            `${openTickets} Open, ${inProgressTickets} In Progress, ${urgentTickets} Urgent`;
    }
}

async function openAdminTicketModal(ticketId) {
    currentAdminTicketId = ticketId;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/tickets/${ticketId}`, {
            credentials: 'include'
        });
        const result = await response.json();

        if (response.ok && result.success) {
            displayAdminTicketModal(result);
            markTicketAsRead(ticketId);
        } else {
            throw new Error(result.message || 'Failed to load ticket details');
        }
    } catch (error) {
        showNotification(error.message || 'Error loading ticket details.', 'error');
    }
}

async function markTicketAsRead(ticketId) {
    try {
        await fetch(`${API_BASE}/api/admin/tickets/${ticketId}/read`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Error marking ticket as read:', error);
    }
}

function displayAdminTicketModal(ticketData) {
    const ticket = ticketData.ticket;
    
    document.getElementById('adminModalTitle').textContent = ticket.title;
    
    document.getElementById('ticketInfoBar').innerHTML = `
        <span><strong>User:</strong> ${ticket.first_name ? `${ticket.first_name} ${ticket.last_name}` : `User #${ticket.user_id}`}</span>
        <span><strong>Type:</strong> ${formatTicketType(ticket.type)}</span>
        <span><strong>Priority:</strong> <span class="admin-ticket-priority priority-${ticket.priority}">${formatPriority(ticket.priority)}</span></span>
        <span><strong>Created:</strong> ${formatDateTime(ticket.created_at)}</span>
        <span><strong>Status:</strong> ${formatStatus(ticket.status)}</span>
    `;
    
    document.getElementById('ticketStatus').value = ticket.status;
    document.getElementById('ticketPriority').value = ticket.priority;
    
    const closeBtn = document.getElementById('closeTicketBtn');
    if (closeBtn) {
        closeBtn.style.display = ticket.status === 'closed' ? 'none' : 'block';
    }
    
    const chatContainer = document.getElementById('adminTicketChat');
    const messages = ticketData.messages || [];
    
    if (messages.length === 0) {
        chatContainer.innerHTML = '<div class="empty-state">No messages yet</div>';
    } else {
        chatContainer.innerHTML = messages.map(message => `
            <div class="message ${message.is_admin ? 'message-support' : 'message-user'}">
                <div class="message-header">
                    <span class="message-sender">${message.is_admin ? 'Support Team' : (message.first_name ? `${message.first_name} ${message.last_name}` : `User #${message.user_id}`)}</span>
                    <span class="message-time">${formatDateTime(message.created_at)}</span>
                </div>
                <div class="message-content">${escapeHtml(message.message)}</div>
            </div>
        `).join('');
    }
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    document.getElementById('adminTicketModal').style.display = 'block';
}

function closeAdminTicketModal() {
    document.getElementById('adminTicketModal').style.display = 'none';
    currentAdminTicketId = null;
    loadAdminTickets();
}

async function updateTicketStatus() {
    const newStatus = document.getElementById('ticketStatus').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/tickets/${currentAdminTicketId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to update status');
        }
        
        showNotification('Ticket status updated successfully!', 'success');
        closeAdminTicketModal();
    } catch (error) {
        showNotification(error.message || 'Error updating ticket status.', 'error');
    }
}

async function updateTicketPriority() {
    const newPriority = document.getElementById('ticketPriority').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/tickets/${currentAdminTicketId}/priority`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ priority: newPriority })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to update priority');
        }
        
        showNotification('Ticket priority updated successfully!', 'success');
        closeAdminTicketModal();
    } catch (error) {
        showNotification(error.message || 'Error updating ticket priority.', 'error');
    }
}

async function sendAdminReply() {
    const message = document.getElementById('adminReplyMessage').value.trim();
    if (!message) return;

    try {
        const response = await fetch(`${API_BASE}/api/admin/tickets/${currentAdminTicketId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ 
                message
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            document.getElementById('adminReplyMessage').value = '';
            openAdminTicketModal(currentAdminTicketId);
        } else {
            throw new Error(result.message || 'Failed to send message');
        }
    } catch (error) {
        showNotification(error.message || 'Error sending message. Please try again.', 'error');
    }
}

async function closeTicket() {
    if (!currentAdminTicketId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/tickets/${currentAdminTicketId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ status: 'closed' })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to close ticket');
        }
        
        showNotification('Ticket closed successfully!', 'success');
        closeAdminTicketModal();
        loadAdminTickets();
    } catch (error) {
        showNotification(error.message || 'Error closing ticket.', 'error');
    }
}

async function refreshTickets() {
    if (isRefreshing) return;
    
    isRefreshing = true;
    try {
        await loadAdminTickets();
        showNotification('Tickets refreshed', 'success');
    } finally {
        isRefreshing = false;
    }
}

function exportTickets() {
    showNotification('Export feature coming soon!', 'success');
}

function showCreateTicketModal() {
    document.getElementById('createTicketModal').style.display = 'block';
}

function closeCreateTicketModal() {
    document.getElementById('createTicketModal').style.display = 'none';
    document.getElementById('createTicketForm').reset();
}

async function handleCreateTicket(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const ticketData = {
        title: formData.get('title'),
        type: formData.get('type'),
        priority: formData.get('priority'),
        description: formData.get('description')
    };

    try {
        const response = await fetch(`${API_BASE}/api/admin/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(ticketData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showNotification('Ticket created successfully!', 'success');
            closeCreateTicketModal();
            loadAdminTickets();
        } else {
            throw new Error(result.message || 'Failed to create ticket');
        }
    } catch (error) {
        showNotification(error.message || 'Error creating ticket. Please try again.', 'error');
    }
}

function formatPriority(priority) {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function formatTicketType(type) {
    const types = {
        'technical': 'Technical Issue',
        'platform_bug': 'Platform Bug',
        'account_issue': 'Account Issue',
        'feature_request': 'Feature Request',
        'other': 'Other'
    };
    return types[type] || type;
}

function formatStatus(status) {
    return status.replace('_', ' ').toUpperCase();
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString();
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `message ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        padding: 18px 24px;
        border-radius: 12px;
        font-size: 14px;
        text-align: left;
        border: 1px solid transparent;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 350px;
        backdrop-filter: blur(10px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        ${type === 'success' ? 
            'background: rgba(0, 255, 198, 0.15); border-color: #00ffc6; color: #b8fff0;' : 
            'background: rgba(255, 75, 75, 0.15); border: 1px solid rgba(255, 75, 75, 1); color: #ff6b6b;'
        }
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentElement) notification.remove();
            }, 300);
        }
    }, 5000);
}

window.onclick = function(event) {
    const modal = document.getElementById('adminTicketModal');
    if (event.target === modal) {
        closeAdminTicketModal();
    }
    const createModal = document.getElementById('createTicketModal');
    if (event.target === createModal) {
        closeCreateTicketModal();
    }
}

function isOnline() {
    return navigator.onLine;
}

function displayTicketsSection(containerId, tickets, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (tickets.length === 0) {
        const emptyMessages = {
            active: {
                icon: '',
                title: 'No Active Tickets',
                message: 'All caught up! No active tickets at the moment.'
            },
            closed: {
                icon: '',
                title: 'No Closed Tickets',
                message: 'No tickets have been closed yet.'
            }
        };
        
        const empty = emptyMessages[type];
        container.innerHTML = `
            <div class="tickets-section-empty">
                <div class="icon">${empty.icon}</div>
                <h4>${empty.title}</h4>
                <p>${empty.message}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tickets.map(ticket => `
        <div class="admin-ticket-item ${getTicketRowClass(ticket)}" onclick="openAdminTicketModal(${ticket.id})">
            <div class="admin-ticket-info">
                <div class="admin-ticket-header">
                    <div class="admin-ticket-title">
                        ${escapeHtml(ticket.title)}
                        ${hasUnreadMessages(ticket) ? '<span class="unread-indicator"></span>' : ''}
                    </div>
                    <div class="admin-ticket-user">${escapeHtml(ticket.first_name ? `${ticket.first_name} ${ticket.last_name}` : `User #${ticket.user_id}`)}</div>
                </div>
                <div class="admin-ticket-meta">
                    <span class="admin-ticket-type">${formatTicketType(ticket.type)}</span>
                    <span class="admin-ticket-priority priority-${ticket.priority}">${formatPriority(ticket.priority)}</span>
                    <span>Created: ${formatDate(ticket.created_at)}</span>
                    <span>Updated: ${formatDate(ticket.updated_at)}</span>
                    ${ticket.message_count > 0 ? `<span>${ticket.message_count} messages</span>` : ''}
                </div>
                <div class="admin-ticket-description">${escapeHtml(ticket.description)}</div>
            </div>
            <div class="admin-ticket-status">
                <span class="admin-status-badge status-${ticket.status}">${formatStatus(ticket.status)}</span>
                <span class="admin-ticket-date">#${ticket.id}</span>
            </div>
        </div>
    `).join('');
}

function updateTicketsCounters(activeCount, closedCount) {
    const activeCounter = document.getElementById('activeTicketsCount');
    const closedCounter = document.getElementById('closedTicketsCount');
    
    if (activeCounter) activeCounter.textContent = activeCount;
    if (closedCounter) closedCounter.textContent = closedCount;
}
