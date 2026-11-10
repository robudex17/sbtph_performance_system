const ExcelJS = require('exceljs')
const { getMonthlyList, getMonthlyOne, getYearlyList, getYearlyOne } = require('./agent_performance_controller')
const { excel } = require('./leaderboard_export')
const { readDepartment, badDepartment, DEPARTMENT_LABELS } = require('./department_scope')
const { getDataBorder, getHeaderBorder, getHeaderStyle } = require('../helper_scripts/global_variables_and_functions')

// Excel of the Agent Monthly / Agent Yearly pages (same pattern as the sales exports, with the CSD data only).
// Admin and poweruser only (routes/evaluation/agent_performance_routes.js).
//   GET /evaluation/agent_performance_export/monthly?year_month=                the list of the month
//   GET /evaluation/agent_performance_export/monthly/:employee_id?year_month=   one employee: the table + the metrics summary
//   GET /evaluation/agent_performance_export/yearly?year=                       the list of the year
//   GET /evaluation/agent_performance_export/yearly/:employee_id?year=          one employee: the submitted months + the year summary
// The monthly exports do not need every evaluation to be submitted (a row not submitted shows an incomplete rating).

const { writeTable, capitalize, toNumber, RATING_COLORS, leadershipOf, individualScoreOf } = excel

const currentYearMonth = () => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

const send = async (res, workbook, filename) => {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    await workbook.xlsx.write(res)
    res.end()
}

// the second table of the sales exports: Metrics Type | Count | (Month) | Year | Score
const writeMetricsSummary = (worksheet, startRow, title, metrics, withMonth) => {
    const headers = withMonth ? ['METRICS TYPE', 'COUNT', 'MONTH', 'YEAR', 'SCORE'] : ['METRICS TYPE', 'COUNT', 'YEAR', 'SCORE']

    worksheet.mergeCells(startRow, 1, startRow, headers.length)
    const titleCell = worksheet.getCell(startRow, 1)
    titleCell.value = title
    titleCell.font = { bold: true, size: 16 }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

    headers.forEach((label, index) => {
        const cell = worksheet.getCell(startRow + 1, index + 1)
        cell.value = label
        cell.style = getHeaderStyle()
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = getHeaderBorder()
    })

    metrics.forEach((metric, rowIndex) => {
        const values = withMonth
            ? [metric.name, metric.count, metric.month, metric.year, metric.score]
            : [metric.name, metric.count, metric.year, metric.score]
        values.forEach((value, index) => {
            const cell = worksheet.getCell(startRow + 2 + rowIndex, index + 1)
            cell.value = value
            cell.border = getDataBorder()
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
        })
    })
}

// the metrics of one employee (a month, or the average of the year)
const metricsOf = (row, month) => [
    // the Performance of the table: INDIV PERF (the individual performance and its score); a leader also has LEAD PERF (the leadership
    // score) and the AVESCORE (the average of the two scores, 5 decimals)
    { name: 'Indiv Perf (%)', count: toNumber(row.performance), month, year: row.year, score: individualScoreOf(row) },
    ...(leadershipOf(row) === '-' ? [] : [
        { name: 'Lead Perf (Score)', count: '-', month, year: row.year, score: toNumber(row.leadership_score) },
        { name: 'AveScore (Performance 80%)', count: '-', month, year: row.year, score: toNumber(row.performance_score) },
    ]),
    { name: 'Absences', count: toNumber(row.absences), month, year: row.year, score: toNumber(row.absence_score) },
    { name: 'Tardiness', count: toNumber(row.tardiness), month, year: row.year, score: toNumber(row.tardiness_score) },
    { name: 'Memo', count: toNumber(row.memo), month, year: row.year, score: toNumber(row.memo_score) },
    { name: 'Feedback', count: toNumber(row.feedback_score), month, year: row.year, score: toNumber(row.feedback_score) },
]

exports.exportMonthly = async (req, res) => {
    const department = readDepartment(req)
    if (!department) return badDepartment(res)

    try {
        const yearMonth = req.query.year_month || currentYearMonth()
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) return res.status(400).json({ message: 'Invalid year_month format. Expected YYYY-MM' })

        const employeeId = req.params.employee_id
        const rows = employeeId
            ? [await getMonthlyOne(req.user, yearMonth, employeeId, department)].filter(Boolean)
            : await getMonthlyList(req.user, yearMonth, department)

        if (rows.length === 0) return res.status(404).json({ message: 'No data to export' })
        // The export does not wait for every row to be submitted any more (the file goes to the GOM): a row that is not submitted
        // shows its rating as incomplete, like the page. To be decided again with the quarterly rule of the leaders ("due this month").

        const workbook = new ExcelJS.Workbook()
        if (employeeId) {
            const row = rows[0]
            const worksheet = workbook.addWorksheet(`${capitalize(row.db_name)}-${row.month}-${row.year}-SCORE`)
            writeTable(rows, worksheet, `${capitalize(row.db_name)} - (MONTHLY PERFORMANCE) ${row.final_ratings} / ${row.ratings_name}`)
            writeMetricsSummary(worksheet, worksheet.lastRow.number + 3, 'Metrics Summary', metricsOf(row, row.month), true)
            return await send(res, workbook, `${department}-${row.db_name}-monthly-performance-${yearMonth}.xlsx`)
        }

        const worksheet = workbook.addWorksheet(`${rows[0].month}-${rows[0].year}-SCORE`)
        writeTable(rows, worksheet, `${DEPARTMENT_LABELS[department]} AGENTS MONTHLY PERFORMANCE`)
        await send(res, workbook, `${department}-agents-monthly-performance-${yearMonth}.xlsx`)

    } catch (error) {
        console.error('Error exporting the CSD monthly performance', error)
        if (!res.headersSent) res.status(500).json({ error: 'Error, Cannot export the CSD monthly performance' })
    }
}

// the yearly list: one row per employee (like the sales yearly list: year, name, status, rating, rating name)
const writeYearlyList = (rows, worksheet, title) => {
    const headers = ['YEAR', 'EMPLOYEE NAME', 'EMPLOYEE STATUS', 'POSITION', 'TEAM', 'MONTHS SUBMITTED', 'PERFORMANCE (%)', 'LEADERSHIP (SCORE)', 'RATING', 'RATING NAME']
    const widths = [10, 20, 18, 30, 20, 18, 16, 20, 12, 24]

    worksheet.mergeCells(1, 1, 1, headers.length)
    const titleCell = worksheet.getCell(1, 1)
    titleCell.value = title
    titleCell.font = { bold: true, size: 24 }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(1).height = 30

    headers.forEach((label, index) => {
        const cell = worksheet.getCell(2, index + 1)
        cell.value = label
        cell.style = getHeaderStyle()
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = getHeaderBorder()
    })
    worksheet.columns = widths.map(width => ({ width }))

    rows.forEach((row, index) => {
        const excelRow = worksheet.getRow(3 + index)
        excelRow.values = [
            row.year, capitalize(row.db_name), row.employee_status || '', row.position_name || '', (row.team_name || '').toUpperCase(),
            row.months_submitted, toNumber(row.performance), leadershipOf(row), toNumber(row.final_ratings), row.ratings_name || '',
        ]
        excelRow.eachCell((cell, colNumber) => {
            cell.border = getDataBorder()
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
            if (colNumber === 3) cell.font = { bold: true, color: { argb: cell.value === 'Resigned' ? 'DB211A' : '14DB3C' } }
            if (colNumber === 10) {
                const colors = RATING_COLORS[cell.value] || { fill: 'FFFFFF', font: '000000' }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } }
                cell.font = { bold: true, color: { argb: colors.font } }
            }
        })
    })
}

exports.exportYearly = async (req, res) => {
    const department = readDepartment(req)
    if (!department) return badDepartment(res)

    try {
        const year = req.query.year || String(new Date().getFullYear())
        if (!/^\d{4}$/.test(year)) return res.status(400).json({ message: 'Invalid year format. Expected YYYY' })

        const employeeId = req.params.employee_id
        const workbook = new ExcelJS.Workbook()

        if (employeeId) {
            const data = await getYearlyOne(req.user, year, employeeId, department)
            if (!data || data.agentMetricsFullYear.length === 0) return res.status(404).json({ message: 'No data to export' })

            const average = data.yearAverage
            const worksheet = workbook.addWorksheet(`${capitalize(average.db_name)}-${year}-SCORE`)
            writeTable(data.agentMetricsFullYear, worksheet, `${capitalize(average.db_name)} - (YEARLY PERFORMANCE) ${average.final_ratings} / ${average.ratings_name}`)
            writeMetricsSummary(worksheet, worksheet.lastRow.number + 3, 'Metrics Year Summary', metricsOf(average, undefined), false)
            return await send(res, workbook, `${department}-${average.db_name}-yearly-performance-${year}.xlsx`)
        }

        const rows = (await getYearlyList(req.user, year, department)).filter(row => row.months_submitted > 0)
        if (rows.length === 0) return res.status(404).json({ message: 'No data to export' })

        const worksheet = workbook.addWorksheet(`${year}-YEARLY`)
        writeYearlyList(rows, worksheet, `${DEPARTMENT_LABELS[department]} AGENTS YEARLY PERFORMANCE`)
        await send(res, workbook, `${department}-agents-yearly-performance-${year}.xlsx`)

    } catch (error) {
        console.error('Error exporting the CSD yearly performance', error)
        if (!res.headersSent) res.status(500).json({ error: 'Error, Cannot export the CSD yearly performance' })
    }
}

// shared with the custom range Excel (custom_range_export.js)
exports.shared = { metricsOf, writeMetricsSummary, send }
