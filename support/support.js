const API_BASE = "http://localhost:3001";
const LOGIN_PATH = "/login/login.html";

let userTickets = [];
let currentTicketId = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadUserTickets();
    setupEventListeners();
});

async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/me`, {
            credentials: 'include'
        });

        if (response.status === 401) {
            window.location.href = LOGIN_PATH;
            return;
        }

        const result = await response.json();
        if (!response.ok || !result.success) {
            window.location.href = LOGIN_PATH;
            return;
        }

    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = LOGIN_PATH;
    }
}

function setupEventListeners() {
    const createTicketForm = document.getElementById('createTicketForm');
    if (createTicketForm) {
        createTicketForm.addEventListener('submit', handleCreateTicket);
    }
}

function showCreateTicket() {
    document.getElementById('createTicketSection').style.display = 'block';
}

function hideCreateTicket() {
    document.getElementById('createTicketSection').style.display = 'none';
    document.getElementById('createTicketForm').reset();
}

async function handleCreateTicket(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const ticketData = {
        title: formData.get('title'),
        type: formData.get('type'),
        description: formData.get('description')
    };

    try {
        const response = await fetch(`${API_BASE}/api/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(ticketData)
        });

        if (response.status === 401) {
            window.location.href = LOGIN_PATH;
            return;
        }

        const result = await response.json();

        if (response.ok && result.success) {
            showNotification('Ticket created successfully!', 'success');
            hideCreateTicket();
            loadUserTickets();
        } else {
            throw new Error(result.message || 'Failed to create ticket');
        }
    } catch (error) {
        console.error('Error creating ticket:', error);
        showNotification(error.message || 'Error creating ticket. Please try again.', 'error');
    }
}

async function loadUserTickets() {
    try {
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        const typeFilter = document.getElementById('typeFilter')?.value || 'all';
        
        let url = `${API_BASE}/api/tickets`;
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (typeFilter !== 'all') params.append('type', typeFilter);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }

        const response = await fetch(url, {
            credentials: 'include'
        });

        if (response.status === 401) {
            window.location.href = LOGIN_PATH;
            return;
        }

        const result = await response.json();

        if (response.ok && result.success) {
            userTickets = result.tickets || [];
            displayUserTickets();
        } else {
            throw new Error(result.message || 'Failed to load tickets');
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
        document.getElementById('ticketsList').innerHTML = 
            '<div class="empty-state">Error loading tickets. Please refresh the page.</div>';
    }
}

function displayUserTickets() {
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const typeFilter = document.getElementById('typeFilter')?.value || 'all';
    
    let filteredTickets = userTickets.filter(ticket => 
        (statusFilter === 'all' || ticket.status === statusFilter) &&
        (typeFilter === 'all' || ticket.type === typeFilter)
    );

    const openTickets = filteredTickets.filter(ticket => ticket.status !== 'closed');
    const closedTickets = filteredTickets.filter(ticket => ticket.status === 'closed');

    const openContainer = document.getElementById('ticketsList');
    if (openContainer) {
        if (openTickets.length === 0) {
            openContainer.innerHTML = '<div class="empty-state">No open tickets found</div>';
        } else {
            openContainer.innerHTML = openTickets.map(ticket => `
                <div class="ticket-item ${ticket.status === 'open' && hasUnreadMessages(ticket) ? 'unread' : ''}" onclick="openTicketModal(${ticket.id})">
                    <div class="ticket-info">
                        <div class="ticket-header">
                            <div class="ticket-title">${escapeHtml(ticket.title)}</div>
                            <div class="ticket-meta">
                                <span class="ticket-type">${formatTicketType(ticket.type)}</span>
                                <span class="ticket-priority priority-${ticket.priority}">${formatPriority(ticket.priority)}</span>
                            </div>
                        </div>
                        <div class="ticket-description">${escapeHtml(ticket.description)}</div>
                        <div class="ticket-dates">
                            <span>Created: ${formatDate(ticket.created_at)}</span>
                            ${ticket.updated_at !== ticket.created_at ? `<span>Updated: ${formatDate(ticket.updated_at)}</span>` : ''}
                        </div>
                    </div>
                    <div class="ticket-status">
                        <span class="status-badge status-${ticket.status}">${formatStatus(ticket.status)}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    const closedContainer = document.getElementById('closedTicketsList');
    if (closedContainer) {
        if (closedTickets.length === 0) {
            closedContainer.innerHTML = '<div class="empty-state">No closed tickets</div>';
        } else {
            closedContainer.innerHTML = closedTickets.map(ticket => `
                <div class="ticket-item closed" onclick="openTicketModal(${ticket.id})">
                    <div class="ticket-info">
                        <div class="ticket-header">
                            <div class="ticket-title">${escapeHtml(ticket.title)}</div>
                            <div class="ticket-meta">
                                <span class="ticket-type">${formatTicketType(ticket.type)}</span>
                            </div>
                        </div>
                        <div class="ticket-dates">
                            <span>Created: ${formatDate(ticket.created_at)}</span>
                            <span>Closed: ${formatDate(ticket.updated_at)}</span>
                        </div>
                    </div>
                    <div class="ticket-status">
                        <span class="status-badge status-closed">CLOSED</span>
                    </div>
                </div>
            `).join('');
        }
    }
}

function hasUnreadMessages(ticket) {
    return (ticket.unread_count || 0) > 0;
}

function filterTickets() {
    loadUserTickets();
}

async function openTicketModal(ticketId) {
    currentTicketId = ticketId;
    
    try {
        const response = await fetch(`${API_BASE}/api/tickets/${ticketId}`, {
            credentials: 'include'
        });

        if (response.status === 401) {
            window.location.href = LOGIN_PATH;
            return;
        }

        const result = await response.json();

        if (response.ok && result.success) {
            displayTicketModal(result);
        } else {
            throw new Error(result.message || 'Failed to load ticket details');
        }
    } catch (error) {
        console.error('Error loading ticket:', error);
        showNotification(error.message || 'Error loading ticket details.', 'error');
    }
}

function displayTicketModal(ticketData) {
    const ticket = ticketData.ticket;
    
    document.getElementById('modalTicketTitle').textContent = ticket.title;
    
    const chatContainer = document.getElementById('ticketChat');
    chatContainer.innerHTML = (ticketData.messages || []).map(message => `
        <div class="message ${message.is_admin ? 'message-support' : 'message-user'}">
            <div class="message-header">
                <span class="message-sender">${message.is_admin ? 'Support Team' : 'You'}</span>
                <span class="message-time">${formatDateTime(message.created_at)}</span>
            </div>
            <div class="message-content">${escapeHtml(message.message)}</div>
        </div>
    `).join('');
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    const replySection = document.getElementById('replySection');
    if (ticket.status === 'closed') {
        replySection.style.display = 'none';
    } else {
        replySection.style.display = 'block';
    }
    
    document.getElementById('ticketModal').style.display = 'block';
}

function closeTicketModal() {
    document.getElementById('ticketModal').style.display = 'none';
    currentTicketId = null;
    loadUserTickets();
}

async function sendReply() {
    const message = document.getElementById('replyMessage').value.trim();
    if (!message) return;

    try {
        const response = await fetch(`${API_BASE}/api/tickets/${currentTicketId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ 
                message
            })
        });

        if (response.status === 401) {
            window.location.href = LOGIN_PATH;
            return;
        }

        const result = await response.json();

        if (response.ok && result.success) {
            document.getElementById('replyMessage').value = '';
            openTicketModal(currentTicketId);
        } else {
            throw new Error(result.message || 'Failed to send message');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification(error.message || 'Error sending message. Please try again.', 'error');
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
    const modal = document.getElementById('ticketModal');
    if (event.target === modal) {
        closeTicketModal();
    }
}