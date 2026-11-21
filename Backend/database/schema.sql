-- Esquema inicial de More Stock para MySQL/TiDB.
-- Este archivo solo define las tablas; no importa datos ni crea cuentas.

CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_salt BINARY(16) NOT NULL,
    password_hash BINARY(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS businesses (
    id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(150) NOT NULL,
    sector VARCHAR(120) NULL,
    is_reference_only BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_businesses_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_memberships (
    business_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    role ENUM('business_admin', 'employee') NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (business_id, user_id),
    KEY idx_business_memberships_user (user_id),
    CONSTRAINT fk_business_memberships_business
        FOREIGN KEY (business_id) REFERENCES businesses (id),
    CONSTRAINT fk_business_memberships_user
        FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    sku VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT '',
    brand VARCHAR(100) NOT NULL DEFAULT '',
    unit VARCHAR(32) NOT NULL,
    PRIMARY KEY (sku),
    KEY idx_products_category (category)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_products (
    business_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    product_sku VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (business_id, product_sku),
    KEY idx_business_products_sku (product_sku),
    CONSTRAINT fk_business_products_business
        FOREIGN KEY (business_id) REFERENCES businesses (id),
    CONSTRAINT fk_business_products_product
        FOREIGN KEY (product_sku) REFERENCES products (sku)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS weekly_sales (
    business_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    product_sku VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    week_number SMALLINT UNSIGNED NOT NULL,
    units_sold DECIMAL(14, 3) NOT NULL,
    list_price_mxn DECIMAL(14, 2) NULL,
    discount_percent DECIMAL(6, 3) NULL,
    unit_price_mxn DECIMAL(14, 2) NULL,
    revenue_mxn DECIMAL(16, 2) NULL,
    unit_cost_mxn DECIMAL(14, 2) NULL,
    gross_profit_mxn DECIMAL(16, 2) NULL,
    opening_stock DECIMAL(14, 3) NULL,
    replenishment_units DECIMAL(14, 3) NULL,
    shrinkage_units DECIMAL(14, 3) NULL,
    closing_stock DECIMAL(14, 3) NULL,
    previous_week_sales DECIMAL(14, 3) NULL,
    is_buen_fin BOOLEAN NOT NULL DEFAULT FALSE,
    is_black_friday BOOLEAN NOT NULL DEFAULT FALSE,
    is_cyber_monday BOOLEAN NOT NULL DEFAULT FALSE,
    is_christmas BOOLEAN NOT NULL DEFAULT FALSE,
    is_back_to_school BOOLEAN NOT NULL DEFAULT FALSE,
    is_mothers_day BOOLEAN NOT NULL DEFAULT FALSE,
    is_promotion BOOLEAN NOT NULL DEFAULT FALSE,
    data_origin ENUM('synthetic', 'operational') NOT NULL,
    source_record_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    PRIMARY KEY (business_id, product_sku, week_start),
    UNIQUE KEY uq_weekly_sales_source_record (source_record_id),
    KEY idx_weekly_sales_business_week (business_id, week_start),
    CONSTRAINT fk_weekly_sales_business_product
        FOREIGN KEY (business_id, product_sku)
        REFERENCES business_products (business_id, product_sku)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS forecast_model_artifacts (
    model_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    model_version VARCHAR(32) NOT NULL,
    data_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    trained_at DATETIME(3) NOT NULL,
    artifact_json JSON NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (model_key),
    KEY idx_forecast_model_fingerprint (data_fingerprint)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS current_inventory (
    business_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    product_sku VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    quantity_on_hand DECIMAL(14, 3) NOT NULL,
    data_origin ENUM('synthetic', 'operational') NOT NULL DEFAULT 'synthetic',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (business_id, product_sku),
    CONSTRAINT fk_current_inventory_business_product
        FOREIGN KEY (business_id, product_sku)
        REFERENCES business_products (business_id, product_sku)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    product_sku VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    movement_type ENUM('purchase', 'sale', 'shrinkage', 'adjustment') NOT NULL,
    quantity_delta DECIMAL(14, 3) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    note VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_inventory_movements_business_product (business_id, product_sku, created_at),
    KEY idx_inventory_movements_user (user_id),
    CONSTRAINT fk_inventory_movements_business_product
        FOREIGN KEY (business_id, product_sku)
        REFERENCES business_products (business_id, product_sku),
    CONSTRAINT fk_inventory_movements_user
        FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token_hash),
    KEY idx_user_sessions_user_expiry (user_id, expires_at),
    CONSTRAINT fk_user_sessions_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
