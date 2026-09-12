-- This is a separate database script, NOT part of your React code!

CREATE DATABASE gonzales_vision_clinic;
USE gonzales_vision_clinic;

CREATE TABLE patients (
    patient_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT,
    gender VARCHAR(10),
    contact VARCHAR(20),
    last_visit DATE,
    status VARCHAR(20) DEFAULT 'Active'
);

CREATE TABLE prescriptions (
    prescription_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(10),
    od_sph VARCHAR(10),
    od_cyl VARCHAR(10),
    os_sph VARCHAR(10),
    os_cyl VARCHAR(10),
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

CREATE TABLE appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    purpose_of_visit VARCHAR(255) NOT NULL,
    appointment_status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 0. Products (added: was referenced by appointment_items / transaction_items below but never defined,
--    which made the original script fail with errno 150 on CREATE TABLE appointment_items)
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    image_url VARCHAR(255),
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock_quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 1. Appointment Items (Fixed Reference)
CREATE TABLE appointment_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 1,
    price_at_booking DECIMAL(10, 2) NOT NULL,
    
    -- Corrected reference to appointment_id
    CONSTRAINT fk_app_items_app 
        FOREIGN KEY (appointment_id) 
        REFERENCES appointments(appointment_id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_app_items_prod 
        FOREIGN KEY (product_id) 
        REFERENCES products(id) 
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2. Transactions (Fixed Reference)
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL, 
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_status ENUM('Pending', 'Paid') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Corrected reference to appointment_id
    CONSTRAINT fk_trans_app 
        FOREIGN KEY (appointment_id) 
        REFERENCES appointments(appointment_id) 
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Transaction Items (Ensure this matches the transactions.id)
CREATE TABLE transaction_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT,
    product_id INT,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    
    CONSTRAINT fk_titems_trans 
        FOREIGN KEY (transaction_id) 
        REFERENCES transactions(id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_titems_prod 
        FOREIGN KEY (product_id) 
        REFERENCES products(id) 
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 4. Users (added: needed for Super-Admin / Admin / Staff login per the capstone scope —
--    the original schema had no auth table at all)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('super_admin', 'admin', 'staff') NOT NULL DEFAULT 'staff',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 5. Frames (added: catalog + 2D-to-3D virtual try-on assets — referenced throughout the
--    paper's scope/objectives but had no table at all in the original schema)
CREATE TABLE frames (
    frame_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(100),
    material VARCHAR(100),
    category VARCHAR(50),
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock_quantity INT NOT NULL DEFAULT 0,
    image_2d_url VARCHAR(255),
    model_3d_url VARCHAR(255),
    conversion_status ENUM('Not Converted', 'Processing', 'Converted', 'Failed') DEFAULT 'Not Converted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;