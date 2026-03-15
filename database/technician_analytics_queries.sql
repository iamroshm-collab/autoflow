-- ==========================================
-- TECHNICIAN PERFORMANCE ANALYTICS QUERIES
-- ==========================================

-- ==========================================
-- 1. Average Completion Time Per Technician
-- ==========================================
-- Returns average job duration in minutes for each technician

SELECT 
    t.id AS technician_id,
    t.name AS technician_name,
    COUNT(ta.id) AS total_jobs_completed,
    ROUND(AVG(ta.job_duration)::numeric, 2) AS avg_completion_time_minutes,
    ROUND((AVG(ta.job_duration) / 60.0)::numeric, 2) AS avg_completion_time_hours
FROM "Technicians" t
LEFT JOIN "TechnicianAllocations" ta ON t.id = ta.technician_id
WHERE ta.status = 'completed' 
    AND ta.job_duration IS NOT NULL
GROUP BY t.id, t.name
ORDER BY avg_completion_time_minutes ASC;

-- ==========================================
-- 2. Total Jobs Completed Per Technician
-- ==========================================

SELECT 
    t.id AS technician_id,
    t.name AS technician_name,
    COUNT(CASE WHEN ta.status = 'completed' THEN 1 END) AS jobs_completed,
    COUNT(CASE WHEN ta.status = 'in_progress' THEN 1 END) AS jobs_in_progress,
    COUNT(CASE WHEN ta.status = 'accepted' THEN 1 END) AS jobs_accepted,
    COUNT(CASE WHEN ta.status = 'assigned' THEN 1 END) AS jobs_assigned,
    COUNT(ta.id) AS total_jobs
FROM "Technicians" t
LEFT JOIN "TechnicianAllocations" ta ON t.id = ta.technician_id
WHERE t.is_active = true
GROUP BY t.id, t.name
ORDER BY jobs_completed DESC;

-- ==========================================
-- 3. Total Earnings Per Technician
-- ==========================================

SELECT 
    t.id AS technician_id,
    t.name AS technician_name,
    COUNT(CASE WHEN ta.status = 'completed' THEN 1 END) AS jobs_completed,
    COALESCE(SUM(ta.earning_amount), 0) AS total_earnings
FROM "Technicians" t
LEFT JOIN "TechnicianAllocations" ta ON t.id = ta.technician_id
WHERE ta.status = 'completed'
GROUP BY t.id, t.name
ORDER BY total_earnings DESC;

-- ==========================================
-- 4. Earnings Per Technician (Date Range)
-- ==========================================

SELECT 
    t.id AS technician_id,
    t.name AS technician_name,
    COUNT(ta.id) AS jobs_completed,
    COALESCE(SUM(ta.earning_amount), 0) AS total_earnings,
    ROUND(AVG(ta.earning_amount)::numeric, 2) AS avg_earning_per_job
FROM "Technicians" t
LEFT JOIN "TechnicianAllocations" ta ON t.id = ta.technician_id
WHERE ta.status = 'completed'
    AND ta.completed_at >= '2026-03-01'  -- Replace with desired start date
    AND ta.completed_at < '2026-04-01'   -- Replace with desired end date
GROUP BY t.id, t.name
ORDER BY total_earnings DESC;

-- ==========================================
-- 5. Technician Efficiency Report
-- ==========================================
-- Combines multiple metrics for comprehensive performance view

SELECT 
    t.id AS technician_id,
    t.name AS technician_name,
    t.phone,
    COUNT(CASE WHEN ta.status = 'completed' THEN 1 END) AS completed_jobs,
    COUNT(CASE WHEN ta.status IN ('assigned', 'accepted', 'in_progress') THEN 1 END) AS active_jobs,
    ROUND(AVG(CASE WHEN ta.status = 'completed' THEN ta.job_duration END)::numeric, 2) AS avg_completion_minutes,
    COALESCE(SUM(CASE WHEN ta.status = 'completed' THEN ta.earning_amount END), 0) AS total_earnings,
    ROUND(AVG(CASE WHEN ta.status = 'completed' THEN ta.earning_amount END)::numeric, 2) AS avg_earnings_per_job
FROM "Technicians" t
LEFT JOIN "TechnicianAllocations" ta ON t.id = ta.technician_id
WHERE t.is_active = true
GROUP BY t.id, t.name, t.phone
ORDER BY completed_jobs DESC;

-- ==========================================
-- 6. Daily Job Completion Stats
-- ==========================================

SELECT 
    DATE(ta.completed_at) AS completion_date,
    COUNT(ta.id) AS jobs_completed,
    COUNT(DISTINCT ta.technician_id) AS active_technicians,
    COALESCE(SUM(ta.earning_amount), 0) AS total_earnings,
    ROUND(AVG(ta.job_duration)::numeric, 2) AS avg_completion_time
FROM "TechnicianAllocations" ta
WHERE ta.status = 'completed'
    AND ta.completed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(ta.completed_at)
ORDER BY completion_date DESC;

-- ==========================================
-- 7. Job Status Overview
-- ==========================================

SELECT 
    ta.status,
    COUNT(ta.id) AS count,
    ROUND((COUNT(ta.id) * 100.0 / SUM(COUNT(ta.id)) OVER ())::numeric, 2) AS percentage
FROM "TechnicianAllocations" ta
GROUP BY ta.status
ORDER BY count DESC;

-- ==========================================
-- 8. Technician Job Details with Vehicle Info
-- ==========================================

SELECT 
    t.name AS technician_name,
    ta.status,
    jc.job_card_number,
    v.registration_number,
    v.make,
    v.model,
    c.name AS customer_name,
    ta.assigned_at,
    ta.accepted_at,
    ta.started_at,
    ta.completed_at,
    ta.job_duration AS duration_minutes,
    ta.earning_amount
FROM "TechnicianAllocations" ta
JOIN "Technicians" t ON ta.technician_id = t.id
JOIN "JobCard" jc ON ta.job_id = jc.id
JOIN "Vehicle" v ON jc.vehicle_id = v.id
JOIN "Customer" c ON jc.customer_id = c.id
ORDER BY ta.assigned_at DESC
LIMIT 100;

-- ==========================================
-- 9. Response Time Analysis
-- ==========================================
-- Time taken by technician to accept job after assignment

SELECT 
    t.id AS technician_id,
    t.name AS technician_name,
    COUNT(ta.id) AS jobs_accepted,
    ROUND(AVG(EXTRACT(EPOCH FROM (ta.accepted_at - ta.assigned_at)) / 60)::numeric, 2) AS avg_response_time_minutes
FROM "Technicians" t
JOIN "TechnicianAllocations" ta ON t.id = ta.technician_id
WHERE ta.accepted_at IS NOT NULL
GROUP BY t.id, t.name
ORDER BY avg_response_time_minutes ASC;

-- ==========================================
-- 10. Top Performing Technicians (This Month)
-- ==========================================

SELECT 
    t.id AS technician_id,
    t.name AS technician_name,
    COUNT(ta.id) AS jobs_completed_this_month,
    COALESCE(SUM(ta.earning_amount), 0) AS earnings_this_month,
    ROUND(AVG(ta.job_duration)::numeric, 2) AS avg_completion_time
FROM "Technicians" t
JOIN "TechnicianAllocations" ta ON t.id = ta.technician_id
WHERE ta.status = 'completed'
    AND ta.completed_at >= DATE_TRUNC('month', CURRENT_DATE)
    AND ta.completed_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY t.id, t.name
HAVING COUNT(ta.id) > 0
ORDER BY jobs_completed_this_month DESC, earnings_this_month DESC
LIMIT 10;

-- ==========================================
-- 11. Pending Jobs by Technician
-- ==========================================

SELECT 
    t.id AS technician_id,
    t.name AS technician_name,
    t.phone,
    COUNT(CASE WHEN ta.status = 'assigned' THEN 1 END) AS assigned_jobs,
    COUNT(CASE WHEN ta.status = 'accepted' THEN 1 END) AS accepted_jobs,
    COUNT(CASE WHEN ta.status = 'in_progress' THEN 1 END) AS in_progress_jobs,
    COUNT(ta.id) AS total_pending
FROM "Technicians" t
LEFT JOIN "TechnicianAllocations" ta ON t.id = ta.technician_id
WHERE t.is_active = true
    AND ta.status IN ('assigned', 'accepted', 'in_progress')
GROUP BY t.id, t.name, t.phone
ORDER BY total_pending DESC;

-- ==========================================
-- 12. Earnings Report by Date Range
-- ==========================================

SELECT 
    t.name AS technician_name,
    DATE(ta.completed_at) AS date,
    COUNT(ta.id) AS jobs_completed,
    SUM(ta.earning_amount) AS daily_earnings
FROM "TechnicianAllocations" ta
JOIN "Technicians" t ON ta.technician_id = t.id
WHERE ta.status = 'completed'
    AND ta.completed_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY t.name, DATE(ta.completed_at)
ORDER BY date DESC, daily_earnings DESC;

-- ==========================================
-- 13. Job Distribution Across Technicians
-- ==========================================
-- Shows workload balance across technicians

SELECT 
    t.name AS technician_name,
    COUNT(CASE WHEN ta.status = 'completed' THEN 1 END) AS completed,
    COUNT(CASE WHEN ta.status = 'in_progress' THEN 1 END) AS in_progress,
    COUNT(CASE WHEN ta.status = 'accepted' THEN 1 END) AS accepted,
    COUNT(CASE WHEN ta.status = 'assigned' THEN 1 END) AS assigned,
    COUNT(ta.id) AS total_allocated
FROM "Technicians" t
LEFT JOIN "TechnicianAllocations" ta ON t.id = ta.technician_id
WHERE t.is_active = true
GROUP BY t.name
ORDER BY total_allocated DESC;

-- ==========================================
-- 14. Create View for Dashboard Summary
-- ==========================================

CREATE OR REPLACE VIEW technician_dashboard_summary AS
SELECT 
    -- Today's stats
    COUNT(CASE WHEN DATE(ta.assigned_at) = CURRENT_DATE THEN 1 END) AS today_total_jobs,
    COUNT(CASE WHEN DATE(ta.assigned_at) = CURRENT_DATE AND ta.status IN ('assigned', 'accepted', 'in_progress') THEN 1 END) AS today_active_jobs,
    COUNT(CASE WHEN DATE(ta.assigned_at) = CURRENT_DATE AND ta.status = 'completed' THEN 1 END) AS today_completed_jobs,
    
    -- This week's stats
    COUNT(CASE WHEN ta.assigned_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) AS week_total_jobs,
    COUNT(CASE WHEN ta.assigned_at >= DATE_TRUNC('week', CURRENT_DATE) AND ta.status = 'completed' THEN 1 END) AS week_completed_jobs,
    
    -- This month's stats
    COUNT(CASE WHEN ta.assigned_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) AS month_total_jobs,
    COUNT(CASE WHEN ta.assigned_at >= DATE_TRUNC('month', CURRENT_DATE) AND ta.status = 'completed' THEN 1 END) AS month_completed_jobs,
    COALESCE(SUM(CASE WHEN ta.assigned_at >= DATE_TRUNC('month', CURRENT_DATE) AND ta.status = 'completed' THEN ta.earning_amount END), 0) AS month_total_earnings
FROM "TechnicianAllocations" ta;

-- Query the dashboard view
SELECT * FROM technician_dashboard_summary;
