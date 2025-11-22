CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    birth_date DATE NULL,
    phone_number VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    account_type ENUM('broker', 'bank', 'crypto', 'cash', 'other') DEFAULT 'other',
    currency CHAR(3) NOT NULL,
    balance DECIMAL(18, 2) NOT NULL DEFAULT 0,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_accounts_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE,
    
    INDEX idx_accounts_user (user_id),
    INDEX idx_accounts_default (user_id, is_default)
);

CREATE TABLE watchlists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    api_symbol VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    instrument_type ENUM('crypto', 'forex', 'stocks') NOT NULL,
    currency VARCHAR(10) DEFAULT NULL,
    exchange VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_watchlists_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE,

    UNIQUE KEY uniq_user_symbol (user_id, symbol),
    INDEX idx_watchlists_user (user_id)
);

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    api_symbol VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    instrument_type ENUM('crypto', 'forex', 'stocks') NOT NULL,
    currency VARCHAR(10) DEFAULT NULL,

    side ENUM('buy', 'sell') NOT NULL,
    quantity DECIMAL(18, 8) NOT NULL,
    entry_price DECIMAL(18, 8) NOT NULL,
    stop_loss DECIMAL(18, 8) DEFAULT NULL,
    take_profit DECIMAL(18, 8) DEFAULT NULL,

    status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME DEFAULT NULL,
    close_price DECIMAL(18, 8) DEFAULT NULL,
    profit_loss DECIMAL(18, 8) DEFAULT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_orders_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE,

    CONSTRAINT fk_orders_account
      FOREIGN KEY (account_id) REFERENCES accounts(id)
      ON DELETE CASCADE,

    INDEX idx_orders_user (user_id),
    INDEX idx_orders_account (account_id, status),
    INDEX idx_orders_symbol (symbol)
);

CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    type ENUM('technical', 'platform_bug', 'account_issue', 'feature_request', 'other') NOT NULL,
    description TEXT NOT NULL,
    status ENUM('open', 'in_progress', 'closed') DEFAULT 'open',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_tickets_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE,
    
    INDEX idx_tickets_user (user_id),
    INDEX idx_tickets_status (status),
    INDEX idx_tickets_priority (priority)
);

CREATE TABLE ticket_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_ticket_messages_ticket
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
      ON DELETE CASCADE,
    
    CONSTRAINT fk_ticket_messages_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE,
    
    INDEX idx_ticket_messages_ticket (ticket_id),
    INDEX idx_ticket_messages_user (user_id)
);

DELETE FROM users WHERE username = 'admin';
INSERT INTO users (first_name, last_name, username, email, password, birth_date, phone_number, created_at) 
VALUES ('Admin', 'User', 'admin', 'admin@moneymind.com', 'Moonshot', NULL, NULL, NOW());