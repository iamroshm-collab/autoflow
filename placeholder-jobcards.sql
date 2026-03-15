-- Placeholder inserts for missing jobcards (review before running)
-- Strategy:
-- 1) Insert a placeholder Customer per jobcard (mobileNo is unique)
-- 2) Insert a placeholder Vehicle linked to that customer (registrationNumber is unique)
-- 3) Insert a JobCard linked to the placeholder Vehicle and Customer
-- All statements are written to be idempotent (use INSERT OR IGNORE / WHERE NOT EXISTS patterns)
-- Replace timestamps or values as needed before running.

BEGIN TRANSACTION;

-- Adjust the list below to include the jobcard legacy IDs you want placeholders for.

-- Placeholder for jobcard legacy 4402
INSERT OR IGNORE INTO Customer (id, mobileNo, name, createdAt, updatedAt)
SELECT 'placeholder_customer_4402', '0000000000-4402', 'Placeholder Customer 4402', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Customer WHERE mobileNo = '0000000000-4402');

INSERT OR IGNORE INTO Vehicle (id, registrationNumber, make, model, customerId, createdAt, updatedAt)
SELECT 'placeholder_vehicle_4402', 'PLACEHOLDER-VEH-4402', 'Placeholder', 'Placeholder', (SELECT id FROM Customer WHERE mobileNo='0000000000-4402'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Vehicle WHERE registrationNumber = 'PLACEHOLDER-VEH-4402');

INSERT OR IGNORE INTO JobCard (id, jobCardNumber, shopCode, serviceDate, fileNo, deliveryDate, total, paidAmount, vehicleStatus, jobcardStatus, jobcardPaymentStatus, electrical, ac, mechanical, others, balance, customerId, vehicleId, createdAt, updatedAt)
SELECT 'placeholder_jobcard_4402', 'PLACEHOLDER-JC-4402', 'AL', CURRENT_TIMESTAMP, 'FILE-4402', NULL, 0.0, 0.0, 'Placeholder', 'Under Service', 'Pending', 0, 0, 0, 0, 0.0, (SELECT id FROM Customer WHERE mobileNo='0000000000-4402'), (SELECT id FROM Vehicle WHERE registrationNumber='PLACEHOLDER-VEH-4402'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM JobCard WHERE jobCardNumber = 'PLACEHOLDER-JC-4402');

-- Placeholder for jobcard legacy 4305
INSERT OR IGNORE INTO Customer (id, mobileNo, name, createdAt, updatedAt)
SELECT 'placeholder_customer_4305', '0000000000-4305', 'Placeholder Customer 4305', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Customer WHERE mobileNo = '0000000000-4305');

INSERT OR IGNORE INTO Vehicle (id, registrationNumber, make, model, customerId, createdAt, updatedAt)
SELECT 'placeholder_vehicle_4305', 'PLACEHOLDER-VEH-4305', 'Placeholder', 'Placeholder', (SELECT id FROM Customer WHERE mobileNo='0000000000-4305'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Vehicle WHERE registrationNumber = 'PLACEHOLDER-VEH-4305');

INSERT OR IGNORE INTO JobCard (id, jobCardNumber, shopCode, serviceDate, fileNo, deliveryDate, total, paidAmount, vehicleStatus, jobcardStatus, jobcardPaymentStatus, electrical, ac, mechanical, others, balance, customerId, vehicleId, createdAt, updatedAt)
SELECT 'placeholder_jobcard_4305', 'PLACEHOLDER-JC-4305', 'AL', CURRENT_TIMESTAMP, 'FILE-4305', NULL, 0.0, 0.0, 'Placeholder', 'Under Service', 'Pending', 0, 0, 0, 0, 0.0, (SELECT id FROM Customer WHERE mobileNo='0000000000-4305'), (SELECT id FROM Vehicle WHERE registrationNumber='PLACEHOLDER-VEH-4305'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM JobCard WHERE jobCardNumber = 'PLACEHOLDER-JC-4305');

-- Placeholder for jobcard legacy 4304
INSERT OR IGNORE INTO Customer (id, mobileNo, name, createdAt, updatedAt)
SELECT 'placeholder_customer_4304', '0000000000-4304', 'Placeholder Customer 4304', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Customer WHERE mobileNo = '0000000000-4304');

INSERT OR IGNORE INTO Vehicle (id, registrationNumber, make, model, customerId, createdAt, updatedAt)
SELECT 'placeholder_vehicle_4304', 'PLACEHOLDER-VEH-4304', 'Placeholder', 'Placeholder', (SELECT id FROM Customer WHERE mobileNo='0000000000-4304'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Vehicle WHERE registrationNumber = 'PLACEHOLDER-VEH-4304');

INSERT OR IGNORE INTO JobCard (id, jobCardNumber, shopCode, serviceDate, fileNo, deliveryDate, total, paidAmount, vehicleStatus, jobcardStatus, jobcardPaymentStatus, electrical, ac, mechanical, others, balance, customerId, vehicleId, createdAt, updatedAt)
SELECT 'placeholder_jobcard_4304', 'PLACEHOLDER-JC-4304', 'AL', CURRENT_TIMESTAMP, 'FILE-4304', NULL, 0.0, 0.0, 'Placeholder', 'Under Service', 'Pending', 0, 0, 0, 0, 0.0, (SELECT id FROM Customer WHERE mobileNo='0000000000-4304'), (SELECT id FROM Vehicle WHERE registrationNumber='PLACEHOLDER-VEH-4304'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM JobCard WHERE jobCardNumber = 'PLACEHOLDER-JC-4304');

-- Placeholder for jobcard legacy 4024
INSERT OR IGNORE INTO Customer (id, mobileNo, name, createdAt, updatedAt)
SELECT 'placeholder_customer_4024', '0000000000-4024', 'Placeholder Customer 4024', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Customer WHERE mobileNo = '0000000000-4024');

INSERT OR IGNORE INTO Vehicle (id, registrationNumber, make, model, customerId, createdAt, updatedAt)
SELECT 'placeholder_vehicle_4024', 'PLACEHOLDER-VEH-4024', 'Placeholder', 'Placeholder', (SELECT id FROM Customer WHERE mobileNo='0000000000-4024'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Vehicle WHERE registrationNumber = 'PLACEHOLDER-VEH-4024');

INSERT OR IGNORE INTO JobCard (id, jobCardNumber, shopCode, serviceDate, fileNo, deliveryDate, total, paidAmount, vehicleStatus, jobcardStatus, jobcardPaymentStatus, electrical, ac, mechanical, others, balance, customerId, vehicleId, createdAt, updatedAt)
SELECT 'placeholder_jobcard_4024', 'PLACEHOLDER-JC-4024', 'AL', CURRENT_TIMESTAMP, 'FILE-4024', NULL, 0.0, 0.0, 'Placeholder', 'Under Service', 'Pending', 0, 0, 0, 0, 0.0, (SELECT id FROM Customer WHERE mobileNo='0000000000-4024'), (SELECT id FROM Vehicle WHERE registrationNumber='PLACEHOLDER-VEH-4024'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM JobCard WHERE jobCardNumber = 'PLACEHOLDER-JC-4024');

-- Placeholder for jobcard legacy 4249
INSERT OR IGNORE INTO Customer (id, mobileNo, name, createdAt, updatedAt)
SELECT 'placeholder_customer_4249', '0000000000-4249', 'Placeholder Customer 4249', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Customer WHERE mobileNo = '0000000000-4249');

INSERT OR IGNORE INTO Vehicle (id, registrationNumber, make, model, customerId, createdAt, updatedAt)
SELECT 'placeholder_vehicle_4249', 'PLACEHOLDER-VEH-4249', 'Placeholder', 'Placeholder', (SELECT id FROM Customer WHERE mobileNo='0000000000-4249'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Vehicle WHERE registrationNumber = 'PLACEHOLDER-VEH-4249');

INSERT OR IGNORE INTO JobCard (id, jobCardNumber, shopCode, serviceDate, fileNo, deliveryDate, total, paidAmount, vehicleStatus, jobcardStatus, jobcardPaymentStatus, electrical, ac, mechanical, others, balance, customerId, vehicleId, createdAt, updatedAt)
SELECT 'placeholder_jobcard_4249', 'PLACEHOLDER-JC-4249', 'AL', CURRENT_TIMESTAMP, 'FILE-4249', NULL, 0.0, 0.0, 'Placeholder', 'Under Service', 'Pending', 0, 0, 0, 0, 0.0, (SELECT id FROM Customer WHERE mobileNo='0000000000-4249'), (SELECT id FROM Vehicle WHERE registrationNumber='PLACEHOLDER-VEH-4249'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM JobCard WHERE jobCardNumber = 'PLACEHOLDER-JC-4249');

-- Placeholder for jobcard legacy 4172
INSERT OR IGNORE INTO Customer (id, mobileNo, name, createdAt, updatedAt)
SELECT 'placeholder_customer_4172', '0000000000-4172', 'Placeholder Customer 4172', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Customer WHERE mobileNo = '0000000000-4172');

INSERT OR IGNORE INTO Vehicle (id, registrationNumber, make, model, customerId, createdAt, updatedAt)
SELECT 'placeholder_vehicle_4172', 'PLACEHOLDER-VEH-4172', 'Placeholder', 'Placeholder', (SELECT id FROM Customer WHERE mobileNo='0000000000-4172'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Vehicle WHERE registrationNumber = 'PLACEHOLDER-VEH-4172');

INSERT OR IGNORE INTO JobCard (id, jobCardNumber, shopCode, serviceDate, fileNo, deliveryDate, total, paidAmount, vehicleStatus, jobcardStatus, jobcardPaymentStatus, electrical, ac, mechanical, others, balance, customerId, vehicleId, createdAt, updatedAt)
SELECT 'placeholder_jobcard_4172', 'PLACEHOLDER-JC-4172', 'AL', CURRENT_TIMESTAMP, 'FILE-4172', NULL, 0.0, 0.0, 'Placeholder', 'Under Service', 'Pending', 0, 0, 0, 0, 0.0, (SELECT id FROM Customer WHERE mobileNo='0000000000-4172'), (SELECT id FROM Vehicle WHERE registrationNumber='PLACEHOLDER-VEH-4172'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM JobCard WHERE jobCardNumber = 'PLACEHOLDER-JC-4172');

-- Placeholder for jobcard legacy 4267
INSERT OR IGNORE INTO Customer (id, mobileNo, name, createdAt, updatedAt)
SELECT 'placeholder_customer_4267', '0000000000-4267', 'Placeholder Customer 4267', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Customer WHERE mobileNo = '0000000000-4267');

INSERT OR IGNORE INTO Vehicle (id, registrationNumber, make, model, customerId, createdAt, updatedAt)
SELECT 'placeholder_vehicle_4267', 'PLACEHOLDER-VEH-4267', 'Placeholder', 'Placeholder', (SELECT id FROM Customer WHERE mobileNo='0000000000-4267'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Vehicle WHERE registrationNumber = 'PLACEHOLDER-VEH-4267');

INSERT OR IGNORE INTO JobCard (id, jobCardNumber, shopCode, serviceDate, fileNo, deliveryDate, total, paidAmount, vehicleStatus, jobcardStatus, jobcardPaymentStatus, electrical, ac, mechanical, others, balance, customerId, vehicleId, createdAt, updatedAt)
SELECT 'placeholder_jobcard_4267', 'PLACEHOLDER-JC-4267', 'AL', CURRENT_TIMESTAMP, 'FILE-4267', NULL, 0.0, 0.0, 'Placeholder', 'Under Service', 'Pending', 0, 0, 0, 0, 0.0, (SELECT id FROM Customer WHERE mobileNo='0000000000-4267'), (SELECT id FROM Vehicle WHERE registrationNumber='PLACEHOLDER-VEH-4267'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM JobCard WHERE jobCardNumber = 'PLACEHOLDER-JC-4267');

-- Placeholder for jobcard legacy 4180
INSERT OR IGNORE INTO Customer (id, mobileNo, name, createdAt, updatedAt)
SELECT 'placeholder_customer_4180', '0000000000-4180', 'Placeholder Customer 4180', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Customer WHERE mobileNo = '0000000000-4180');

INSERT OR IGNORE INTO Vehicle (id, registrationNumber, make, model, customerId, createdAt, updatedAt)
SELECT 'placeholder_vehicle_4180', 'PLACEHOLDER-VEH-4180', 'Placeholder', 'Placeholder', (SELECT id FROM Customer WHERE mobileNo='0000000000-4180'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Vehicle WHERE registrationNumber = 'PLACEHOLDER-VEH-4180');

INSERT OR IGNORE INTO JobCard (id, jobCardNumber, shopCode, serviceDate, fileNo, deliveryDate, total, paidAmount, vehicleStatus, jobcardStatus, jobcardPaymentStatus, electrical, ac, mechanical, others, balance, customerId, vehicleId, createdAt, updatedAt)
SELECT 'placeholder_jobcard_4180', 'PLACEHOLDER-JC-4180', 'AL', CURRENT_TIMESTAMP, 'FILE-4180', NULL, 0.0, 0.0, 'Placeholder', 'Under Service', 'Pending', 0, 0, 0, 0, 0.0, (SELECT id FROM Customer WHERE mobileNo='0000000000-4180'), (SELECT id FROM Vehicle WHERE registrationNumber='PLACEHOLDER-VEH-4180'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM JobCard WHERE jobCardNumber = 'PLACEHOLDER-JC-4180');

-- Placeholder for jobcard legacy 4380
INSERT OR IGNORE INTO Customer (id, mobileNo, name, createdAt, updatedAt)
SELECT 'placeholder_customer_4380', '0000000000-4380', 'Placeholder Customer 4380', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Customer WHERE mobileNo = '0000000000-4380');

INSERT OR IGNORE INTO Vehicle (id, registrationNumber, make, model, customerId, createdAt, updatedAt)
SELECT 'placeholder_vehicle_4380', 'PLACEHOLDER-VEH-4380', 'Placeholder', 'Placeholder', (SELECT id FROM Customer WHERE mobileNo='0000000000-4380'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Vehicle WHERE registrationNumber = 'PLACEHOLDER-VEH-4380');

INSERT OR IGNORE INTO JobCard (id, jobCardNumber, shopCode, serviceDate, fileNo, deliveryDate, total, paidAmount, vehicleStatus, jobcardStatus, jobcardPaymentStatus, electrical, ac, mechanical, others, balance, customerId, vehicleId, createdAt, updatedAt)
SELECT 'placeholder_jobcard_4380', 'PLACEHOLDER-JC-4380', 'AL', CURRENT_TIMESTAMP, 'FILE-4380', NULL, 0.0, 0.0, 'Placeholder', 'Under Service', 'Pending', 0, 0, 0, 0, 0.0, (SELECT id FROM Customer WHERE mobileNo='0000000000-4380'), (SELECT id FROM Vehicle WHERE registrationNumber='PLACEHOLDER-VEH-4380'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM JobCard WHERE jobCardNumber = 'PLACEHOLDER-JC-4380');

-- Placeholder for jobcard legacy 4225
INSERT OR IGNORE INTO Customer (id, mobileNo, name, createdAt, updatedAt)
SELECT 'placeholder_customer_4225', '0000000000-4225', 'Placeholder Customer 4225', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Customer WHERE mobileNo = '0000000000-4225');

INSERT OR IGNORE INTO Vehicle (id, registrationNumber, make, model, customerId, createdAt, updatedAt)
SELECT 'placeholder_vehicle_4225', 'PLACEHOLDER-VEH-4225', 'Placeholder', 'Placeholder', (SELECT id FROM Customer WHERE mobileNo='0000000000-4225'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Vehicle WHERE registrationNumber = 'PLACEHOLDER-VEH-4225');

INSERT OR IGNORE INTO JobCard (id, jobCardNumber, shopCode, serviceDate, fileNo, deliveryDate, total, paidAmount, vehicleStatus, jobcardStatus, jobcardPaymentStatus, electrical, ac, mechanical, others, balance, customerId, vehicleId, createdAt, updatedAt)
SELECT 'placeholder_jobcard_4225', 'PLACEHOLDER-JC-4225', 'AL', CURRENT_TIMESTAMP, 'FILE-4225', NULL, 0.0, 0.0, 'Placeholder', 'Under Service', 'Pending', 0, 0, 0, 0, 0.0, (SELECT id FROM Customer WHERE mobileNo='0000000000-4225'), (SELECT id FROM Vehicle WHERE registrationNumber='PLACEHOLDER-VEH-4225'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM JobCard WHERE jobCardNumber = 'PLACEHOLDER-JC-4225');

COMMIT;
