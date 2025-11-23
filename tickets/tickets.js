const API_BASE = "http://localhost:3001";

let adminTickets = [];
let currentAdminTicketId = null;

function setupAdminEventListeners() {
    const refreshBtn = document.querySelector('.primary-ghost');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshTickets);
    }
}

async function loadAdminTickets() {
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
        console.error('Error loading tickets:', error);
        showErrorState('Error loading tickets. Please refresh the page.');
    }
}

function showLoadingState() {
    const container = document.getElementById('adminTicketsList');
    if (container) {
        container.innerHTML = '<div class="loading-state">Loading tickets...</div>';
    }
}

function showErrorState(message) {
    const container = document.getElementById('adminTicketsList');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">⚠️</div>
                <div>${message}</div>
                <button class="primary-btn" onclick="loadAdminTickets()" style="margin-top: 16px;">Try Again</button>
            </div>
        `;
    }
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

    filteredTickets.sort((a, b) => {
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

    const container = document.getElementById('adminTicketsList');
    if (!container) return;
    
    if (filteredTickets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📭</div>
                <div>No tickets match your filters</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredTickets.map(ticket => `
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

function updateStatistics(tickets) {
    const openTickets = tickets.filter(t => t.status === 'open').length;
    const urgentTickets = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed').length;
    const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
    
    const respondedTickets = tickets.filter(t => 
        t.status !== 'open' && t.message_count > 0
    ).length;
    const responseRate = tickets.length > 0 ? Math.round((respondedTickets / tickets.length) * 100) : 0;
    
    document.getElementById('openTicketsCount').textContent = openTickets;
    document.getElementById('urgentTicketsCount').textContent = urgentTickets;
    document.getElementById('inProgressCount').textContent = inProgressTickets;
    document.getElementById('responseRate').textContent = `${responseRate}%`;
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
        console.error('Error loading ticket:', error);
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
        console.error('Error updating status:', error);
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
        console.error('Error updating priority:', error);
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
        console.error('Error sending message:', error);
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
        console.error('Error closing ticket:', error);
        showNotification(error.message || 'Error closing ticket.', 'error');
    }
}

function refreshTickets() {
    loadAdminTickets();
    showNotification('Tickets refreshed', 'success');
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

document.addEventListener('DOMContentLoaded', function() {
    const createTicketForm = document.getElementById('createTicketForm');
    if (createTicketForm) {
        createTicketForm.addEventListener('submit', handleCreateTicket);
    }
});

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
        console.error('Error creating ticket:', error);
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
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'rgba(0, 255, 198, 0.9)' : 'rgba(255, 87, 87, 0.9)'};
        color: #000;
        padding: 12px 20px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
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