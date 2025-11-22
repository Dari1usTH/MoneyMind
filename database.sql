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

