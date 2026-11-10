const pool = require('../../config/db')

// The departments where a person sees the whole department on the evaluation pages (the Leaderboard details, the Agent Performance and
// the Team Performance), like the manager of the department does. One row per person and department in department_performance_viewers.
// The login puts the list in the token (viewer_departments), the rules are in controllers/evaluation/visibility_rules.js.
// A table that does not exist yet (the migration is not run) gives no access: the login must never fail because of it.
exports.viewerDepartmentsOf = async (employeeId) => {
    try {
        const [rows] = await pool.execute('SELECT department_code FROM department_performance_viewers WHERE employee_id = ?', [employeeId])
        return rows.map(row => String(row.department_code).trim().toLowerCase())
    } catch (error) {
        console.error('Cannot read department_performance_viewers:', error.message)
        return []
    }
}
