-- OPTIONAL seed data — run this AFTER schema.sql, only if you want test accounts/sample data.
-- Not required for the system to work; you can create real accounts via
-- POST /api/auth/users once you have at least one super_admin logged in.

USE gonzales_vision_clinic;

-- Test login accounts
-- superadmin / admin123  (role: super_admin — Account management + System monitoring ONLY)
-- adminuser  / admin123  (role: admin — runs the full operation: patients, appointments, POS, inventory)
-- staffuser  / staff123  (role: staff — Appointment scheduling + Frames inventory only)
INSERT INTO users (username, password_hash, full_name, role) VALUES
  ('superadmin', '$2b$10$MQUQkKxlOkcpkLrk/zGt4OIzpk.Y0HMgnggM12PAthSuOiTvRHhRq', 'System Super Admin', 'super_admin'),
  ('adminuser',  '$2b$10$onT7LMiZrB9s89.0aoKgYeVKfeSOqDYSWsnc.c8FxJDU0UfLJszhO', 'Clinic Administrator', 'admin'),
  ('staffuser',  '$2b$10$LZ8UWyK3QsUMD2pfxxMjY.ke84f7x.ibyWHb8RQS61oVwphLscck.', 'Front Desk Staff',   'staff');

-- Sample patient
INSERT INTO patients (patient_id, name, age, gender, contact, last_visit, status) VALUES
  ('P001', 'Juan Dela Cruz', 30, 'Male', '09171234567', '2026-06-01', 'Active');

-- Sample POS / inventory products
INSERT INTO products (name, category, description, image_url, price, stock_quantity) VALUES
  ('Ray-Ban Aviator Frame', 'Frame', 'Classic gold-tone aviator with green tinted lenses.', '/uploads/products/aviator.jpg', 3500.00, 10),
  ('Anti-Reflective Lens Coating', 'Service', 'Reduces glare and reflections on prescription lenses.', '/uploads/products/ar-coating.jpg', 800.00, 999);
