-- =============================================================================
-- SAMPLE DATA FOR TESTING
-- Insert test customers and vehicles
-- =============================================================================

-- Insert Sample Customers
INSERT INTO Customer (CustomerName, Address, MobileNo, StateID, GSTIN, PAN, DateCreated) VALUES
('John Doe', '123 Main Street, Bangalore, Karnataka 560001', 9999999999, 1, 'GSTIN123', 'PAN123', CURRENT_TIMESTAMP),
('Ramesh Kumar', '456 Park Avenue, Bangalore, Karnataka 560002', 9999988888, 1, 'GSTIN456', 'PAN456', CURRENT_TIMESTAMP),
('Priya Sharma', '789 Garden Lane, Bangalore, Karnataka 560003', 9999977777, 1, NULL, 'PAN789', CURRENT_TIMESTAMP),
('Amit Patel', '321 Business Plaza, Bangalore, Karnataka 560004', 9999966666, 1, 'GSTIN789', NULL, CURRENT_TIMESTAMP),
('Neha Singh', '654 Tech Park, Bangalore, Karnataka 560005', 9999955555, 1, NULL, NULL, CURRENT_TIMESTAMP),
('Vikram Reddy', '987 Commercial Street, Bangalore, Karnataka 560006', 9999944444, 2, 'GSTIN987', 'PAN987', CURRENT_TIMESTAMP),
('Ananya Das', '111 Innovation Hub, Bangalore, Karnataka 560007', 9999933333, 1, NULL, 'PAN111', CURRENT_TIMESTAMP),
('Sanjay Gupta', '222 Corporate Avenue, Bangalore, Karnataka 560008', 9999922222, 1, 'GSTIN222', 'PAN222', CURRENT_TIMESTAMP);

-- Insert Sample Vehicles
-- Note: CustomerID references are based on the insertion above
-- Customer 1 (John Doe) - 2 vehicles
INSERT INTO Vehicle (CustomerID, RegistrationNumber, VehicleMake, VehicleModel, DateCreated) VALUES
(1, 'KA-01-AB-1234', 'Maruti', 'Swift', CURRENT_TIMESTAMP),
(1, 'KA-01-AB-5678', 'Hyundai', 'i10', CURRENT_TIMESTAMP);

-- Customer 2 (Ramesh Kumar) - 1 vehicle
INSERT INTO Vehicle (CustomerID, RegistrationNumber, VehicleMake, VehicleModel, DateCreated) VALUES
(2, 'KA-02-CD-1234', 'Tata', 'Nexon', CURRENT_TIMESTAMP);

-- Customer 3 (Priya Sharma) - 1 vehicle
INSERT INTO Vehicle (CustomerID, RegistrationNumber, VehicleMake, VehicleModel, DateCreated) VALUES
(3, 'KA-03-EF-1234', 'Honda', 'City', CURRENT_TIMESTAMP);

-- Customer 4 (Amit Patel) - 2 vehicles
INSERT INTO Vehicle (CustomerID, RegistrationNumber, VehicleMake, VehicleModel, DateCreated) VALUES
(4, 'KA-04-GH-1234', 'Toyota', 'Innova', CURRENT_TIMESTAMP),
(4, 'KA-04-GH-5678', 'Mahindra', 'XUV500', CURRENT_TIMESTAMP);

-- Customer 5 (Neha Singh) - 1 vehicle
INSERT INTO Vehicle (CustomerID, RegistrationNumber, VehicleMake, VehicleModel, DateCreated) VALUES
(5, 'KA-05-IJ-1234', 'Kia', 'Seltos', CURRENT_TIMESTAMP);

-- Customer 6 (Vikram Reddy) - 3 vehicles
INSERT INTO Vehicle (CustomerID, RegistrationNumber, VehicleMake, VehicleModel, DateCreated) VALUES
(6, 'KA-06-KL-1234', 'Maruti', 'Alto', CURRENT_TIMESTAMP),
(6, 'KA-06-KL-5678', 'Skoda', 'Rapid', CURRENT_TIMESTAMP),
(6, 'KA-06-KL-9999', 'Volkswagen', 'Polo', CURRENT_TIMESTAMP);

-- Customer 7 (Ananya Das) - 1 vehicle
INSERT INTO Vehicle (CustomerID, RegistrationNumber, VehicleMake, VehicleModel, DateCreated) VALUES
(7, 'KA-07-MN-1234', 'Renault', 'Kwid', CURRENT_TIMESTAMP);

-- Customer 8 (Sanjay Gupta) - 2 vehicles
INSERT INTO Vehicle (CustomerID, RegistrationNumber, VehicleMake, VehicleModel, DateCreated) VALUES
(8, 'KA-08-OP-1234', 'Jeep', 'Compass', CURRENT_TIMESTAMP),
(8, 'KA-08-OP-5678', 'MG', 'Hector', CURRENT_TIMESTAMP);

-- =============================================================================
-- VERIFICATION QUERIES - Run these to verify data was inserted correctly
-- =============================================================================

-- Count total customers
-- SELECT COUNT(*) AS TotalCustomers FROM Customer;

-- Count total vehicles
-- SELECT COUNT(*) AS TotalVehicles FROM Vehicle;

-- Show all customers with vehicle count
-- SELECT c.CustomerID, c.CustomerName, c.MobileNo, COUNT(v.VehicleID) AS VehicleCount
-- FROM Customer c
-- LEFT JOIN Vehicle v ON c.CustomerID = v.CustomerID
-- GROUP BY c.CustomerID
-- ORDER BY c.CustomerName;

-- Show all vehicles with customer name
-- SELECT v.VehicleID, v.RegistrationNumber, v.VehicleMake, v.VehicleModel, c.CustomerName, c.MobileNo
-- FROM Vehicle v
-- INNER JOIN Customer c ON v.CustomerID = c.CustomerID
-- ORDER BY c.CustomerName, v.RegistrationNumber;
