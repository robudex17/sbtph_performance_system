-- View of the whole department: a person (for example the senior team leader of Purchasing, Ivy) sees the whole department on the
-- Leaderboard details, the Agent Performance (Monthly, Yearly) and the Team Performance (Team_Monthly, Team_Yearly), like the manager of
-- the department does. Only the view: the title, the leadership form, the Performance and the feedback of the person do not change.
-- One row per person and department. The person logs in again after a row is added or removed (the list is kept in the login token).

CREATE TABLE IF NOT EXISTS department_performance_viewers (
  employee_id int NOT NULL,
  department_code varchar(30) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, department_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- department_code is the code of the department of the pages: csd, collection, purchasing, hradmin (lower case).
-- Give the access (replace the id of the employee, then run it):
-- INSERT INTO department_performance_viewers (employee_id, department_code) VALUES (/* id of Ivy */, 'purchasing');

-- Take it away:
-- DELETE FROM department_performance_viewers WHERE employee_id = /* id */ AND department_code = 'purchasing';
