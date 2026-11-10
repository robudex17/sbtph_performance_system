const { generateCsdEvaluation } = require('./evaluation_controller')
const { readDepartment, badDepartment } = require('./department_scope')
const { canSee } = require('./visibility_rules')
const { scoring } = require('./leaderboard_controller')

// Agent Monthly / Agent Yearly performance of the CSD staff (the "Agent Performance" and "Performance Evaluation" menus).
// Same idea as the sales pages: a list of everybody the user may see, and the performance of one employee.
// Scores and ratings are the ones of the CSD leaderboard (leaderboard_controller.js, built on the CSD evaluation).
//
// Who sees whom (checked here, the pages only follow it):
//   admin, poweruser, position level 10   everybody (level 1 - 10)
//   position level 9 (assistant manager)  everybody of level 1 - 9
//   position level 8 and 7                his/her own team (him/her included)
//   position level 1, 2, 3                only him/herself
//
// Monthly:  GET /evaluation/agent_performance/monthly?year_month=YYYY-MM            the list
//           GET /evaluation/agent_performance/monthly/:employee_id?year_month=...   one employee
// Yearly:   GET /evaluation/agent_performance/yearly?year=YYYY                      the list (average of the submitted months)
//           GET /evaluation/agent_performance/yearly/:employee_id?year=YYYY         the submitted months + the year average
// Like the sales yearly pages, only the SUBMITTED months count.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const { toNumber, round4, ratingName, scoreEmployee, loadScoreTables } = { ...scoring }

const AVERAGE_KEYS = [
    'performance', 'performance_score', 'team_performance_score', 'leadership_score', 'absence_score', 'tardiness_score', 'memo_score', 'feedback_score',
    'performance_rating', 'absence_rating', 'tardiness_rating', 'memo_rating', 'feedback_rating', 'final_ratings',
]
const SUM_KEYS = ['absences', 'tardiness', 'memo']
// the averages of the Performance have 5 decimals (rounded up when necessary), the others 4
const FIVE_DECIMALS_KEYS = ['performance', 'performance_score', 'team_performance_score', 'leadership_score']

const currentYearMonth = () => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

// every employee of the month (all position levels) with the scores, only the ones the user may see
// scoreMonth: EVERYBODY of the month (the team pages need all the teams to know the best one), visibleOf: what the user may see
const scoreMonth = async (user, yearMonth, tables, department = 'csd') => {
    const evaluation = await generateCsdEvaluation(yearMonth, 'all', department, 'all', 'all', null, user)
    const scored = evaluation.map(agent => scoreEmployee(agent, tables))

    // the team of the user in the month: the team of his/her own row
    const ownTeamId = scored.find(row => Number(row.id) === Number(user?.login_id))?.team_id ?? null

    return { scored, ownTeamId, department }
}

const visibleOf = (user, { scored, ownTeamId, department }) => scored.filter(row => canSee(user, row, ownTeamId, department))

const buildMonth = async (user, yearMonth, tables, department = 'csd') =>
    visibleOf(user, await scoreMonth(user, yearMonth, tables, department))

const monthsOfTheYear = (year) => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth()               // 0 = January
    if (Number(year) < currentYear) return MONTH_NAMES.map((_, index) => index)
    if (Number(year) === currentYear) return MONTH_NAMES.slice(0, currentMonth + 1).map((_, index) => index)
    return []                                                // a future year has no data
}

// is there a month that is not submitted between submitted months (the months before the first one and after the last one are normal)
const hasGap = (allRecords) => {
    const submittedIndexes = allRecords.map((record, index) => (record.submitted === 1 ? index : -1)).filter(index => index >= 0)
    if (submittedIndexes.length === 0) return false
    const first = submittedIndexes[0], last = submittedIndexes[submittedIndexes.length - 1]
    return allRecords.slice(first, last + 1).some(record => record.submitted !== 1)
}

// the average of the submitted months of one employee ('records' are the scored rows of the months)
const yearAverage = (records, allRecords, tables, year) => {
    const latest = records[records.length - 1] ?? allRecords[allRecords.length - 1]
    const result = {
        id: latest.id,
        db_name: latest.db_name,
        image_link: latest.image_link,
        employee_status: latest.employee_status,
        position_name: latest.position_name,
        position_level: latest.position_level,
        manager_dbname: latest.manager_dbname,
        team_id: latest.team_id,
        team_name: latest.team_name,
        year: Number(year),
        months_submitted: records.length,
        // a leader (position level 7 - 10): the leadership performance is part of the Performance
        leadership_required: records.some(record => record.leadership_required),
        // a month between the first and the last submitted month that is not submitted (it is not counted)
        hasIncomplete: hasGap(allRecords),
    }

    AVERAGE_KEYS.forEach(key => {
        const sum = records.reduce((total, record) => total + toNumber(record[key]), 0)
        const decimals = FIVE_DECIMALS_KEYS.includes(key) ? 5 : 4
        result[key] = records.length ? (sum / records.length).toFixed(decimals) : (0).toFixed(decimals)
    })
    SUM_KEYS.forEach(key => {
        result[key] = records.reduce((total, record) => total + toNumber(record[key]), 0)
    })

    if (records.length === 0) {
        result.ratings_name = 'No Ratings'
    } else {
        result.ratings_name = ratingName(tables.ratings, parseFloat(result.final_ratings))
    }
    return result
}

// all the scored rows of the year, grouped by employee (only the employees the user may see)
const buildYear = async (user, year, department = 'csd') => {
    const tables = await loadScoreTables()
    const months = monthsOfTheYear(year)

    const byEmployee = new Map()
    for (const monthIndex of months) {
        const yearMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
        const rows = await buildMonth(user, yearMonth, tables, department)
        for (const row of rows) {
            if (!byEmployee.has(row.id)) byEmployee.set(row.id, [])
            byEmployee.get(row.id).push(row)
        }
    }
    return { tables, byEmployee }
}

const readYear = (req) => {
    const year = req.query.year || String(new Date().getFullYear())
    return /^\d{4}$/.test(year) ? year : null
}

// shared with the team performance pages (team_performance_controller.js)
exports.shared = { buildMonth, scoreMonth, visibleOf, buildYear, yearAverage, readYear, currentYearMonth }

// the data of the four pages, used by the routes and by the Excel export (agent_performance_export.js)
exports.getMonthlyList = async (user, yearMonth, department = 'csd') => {
    const tables = await loadScoreTables()
    const rows = await buildMonth(user, yearMonth, tables, department)
    return rows.sort((a, b) => parseFloat(b.final_ratings) - parseFloat(a.final_ratings))
}

exports.getMonthlyOne = async (user, yearMonth, employeeId, department = 'csd') => {
    const rows = await exports.getMonthlyList(user, yearMonth, department)
    return rows.find(row => String(row.id) === String(employeeId)) ?? null
}

exports.getYearlyList = async (user, year, department = 'csd') => {
    const { tables, byEmployee } = await buildYear(user, year, department)
    const list = []
    for (const records of byEmployee.values()) {
        list.push(yearAverage(records.filter(record => record.submitted === 1), records, tables, year))
    }
    return list.sort((a, b) => parseFloat(b.final_ratings) - parseFloat(a.final_ratings))
}

exports.getYearlyOne = async (user, year, employeeId, department = 'csd') => {
    const { tables, byEmployee } = await buildYear(user, year, department)
    const records = byEmployee.get(Number(employeeId))
    if (!records) return null

    const submitted = records.filter(record => record.submitted === 1)
    return {
        agentMetricsFullYear: submitted,
        yearAverage: yearAverage(submitted, records, tables, year),
    }
}

const sendResult = async (res, work) => {
    try {
        const data = await work()
        res.status(200).json(data)
    } catch (error) {
        console.error('Error fetching the CSD agent performance', error)
        res.status(500).json({ error: 'Database Error, Cannot Fetch CSD agent performance' })
    }
}

exports.fetchMonthly = async (req, res) => {
    const yearMonth = req.query.year_month || currentYearMonth()
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
        return res.status(400).json({ message: 'Invalid year_month format. Expected YYYY-MM' })
    }

    const department = readDepartment(req)
    if (!department) return badDepartment(res)

    const employeeId = req.params.employee_id
    await sendResult(res, async () => {
        if (!employeeId) return exports.getMonthlyList(req.user, yearMonth, department)

        const row = await exports.getMonthlyOne(req.user, yearMonth, employeeId, department)
        // not in the month, or not somebody the user may see: nothing is told about the difference
        return row ? [row] : []
    })
}

exports.fetchYearly = async (req, res) => {
    const year = readYear(req)
    if (!year) return res.status(400).json({ message: 'Invalid year format. Expected YYYY' })

    const department = readDepartment(req)
    if (!department) return badDepartment(res)

    const employeeId = req.params.employee_id
    await sendResult(res, async () => {
        if (!employeeId) return exports.getYearlyList(req.user, year, department)

        const data = await exports.getYearlyOne(req.user, year, employeeId, department)
        return data ?? { agentMetricsFullYear: [], yearAverage: null }
    })
}
