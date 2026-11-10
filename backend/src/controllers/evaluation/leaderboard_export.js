const ExcelJS = require('exceljs')
const { buildCsdLeaderboard } = require('./leaderboard_controller')
const { readDepartment, badDepartment, DEPARTMENT_LABELS } = require('./department_scope')
const { getDataBorder, getHeaderBorder, getHeaderStyle } = require('../helper_scripts/global_variables_and_functions')

// Excel export of the CSD leaderboard (table view of the page), same look as the sales leaderboard export.
// GET /evaluation/leaderboard_export/:scope?year_month=YYYY-MM   (admin and poweruser)
// Only agent and team_leader: the team board is shown as cards only. It is exported also when the evaluation of somebody in
// the list is not submitted yet (that row keeps its incomplete rating).

const SCOPE_TITLES = {
    agent: 'LEADERBOARD - AGENTS (MONTHLY PERFORMANCE)',
    team_leader: 'LEADERBOARD - TEAM LEADERS (MONTHLY PERFORMANCE)',
}

const COLUMN_GROUPS = [
    { label: 'EMPLOYEE EMPLOYMENTS AND ASSIGNMENTS', subHeaders: ['YEAR', 'MONTH', 'EMPLOYEE NAME', 'EMPLOYEE STATUS', 'POSITION', 'IMMEDIATE HEAD', 'TEAM'] },
    // the leaders (position level 7 - 10) have the leadership performance: AVESCORE is the average of the individual performance score and the
    // leadership score ('-' for the others, their AVESCORE is the individual performance score)
    { label: 'PERFORMANCE (80%)', subHeaders: ['INDIV PERF (%)', 'INDIV PERF (SCORE)', 'LEAD PERF (SCORE)', 'AVESCORE', 'TOTAL'] },
    { label: 'ATTENDANCE (10%)', subHeaders: ['ABSENCES', 'TARDINESS', 'TOTAL'] },
    { label: 'MEMO AND FEEDBACK (10%)', subHeaders: ['MEMO', 'FEEDBACK', 'TOTAL'] },
    { label: 'GRAND TOTAL', subHeaders: [] },
    { label: 'RATING', subHeaders: [] },
]

const COLUMN_WIDTHS = [10, 12, 20, 18, 30, 20, 20, 14, 16, 16, 12, 10, 12, 12, 10, 10, 12, 10, 14, 24]

const capitalize = (word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const RATING_COLORS = {
    'EXCEPTIONAL': { fill: '7414DB', font: 'FFFFFF' },
    'VERY SATISFACTORY': { fill: '0069DB', font: 'FFFFFF' },
    'SATISFACTORY': { fill: '00DB4E', font: '000000' },
    'NEEDS IMPROVEMENT': { fill: 'D99307', font: '000000' },
    'POOR': { fill: 'DB211A', font: '000000' },
    'INCOMPLETE RATING': { fill: 'DBC414', font: 'FFFFFF' },
}

// the leadership performance (score) of a leader whose leadership evaluation is answered, '-' for the others
const leadershipOf = (row) => (row.leadership_required && toNumber(row.leadership_score) > 0 ? toNumber(row.leadership_score) : '-')

// the score of the individual performance (%): for a leader it is one part of the AVESCORE, for the others it is the performance score
const individualScoreOf = (row) => toNumber(leadershipOf(row) === '-' ? row.performance_score : row.team_performance_score)

const writeTable = (rows, worksheet, title) => {
    const totalCols = COLUMN_GROUPS.reduce((sum, group) => sum + Math.max(group.subHeaders.length, 1), 0)

    // title
    worksheet.mergeCells(1, 1, 1, totalCols)
    const titleCell = worksheet.getCell(1, 1)
    titleCell.value = title
    titleCell.font = { bold: true, size: 24 }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(1).height = 30

    // two header rows (group + sub headers); a group without sub headers spans the two rows
    let col = 1
    for (const group of COLUMN_GROUPS) {
        const span = Math.max(group.subHeaders.length, 1)
        const headerCell = worksheet.getCell(2, col)
        headerCell.value = group.label
        headerCell.style = getHeaderStyle()
        headerCell.alignment = { horizontal: 'center', vertical: 'middle' }
        headerCell.border = getHeaderBorder()

        if (group.subHeaders.length > 0) {
            worksheet.mergeCells(2, col, 2, col + span - 1)
            group.subHeaders.forEach((label, i) => {
                const cell = worksheet.getCell(3, col + i)
                cell.value = label
                cell.style = getHeaderStyle()
                cell.alignment = { horizontal: 'center', vertical: 'middle' }
                cell.border = getHeaderBorder()
            })
        } else {
            worksheet.mergeCells(2, col, 3, col)
        }
        col += span
    }

    worksheet.columns = COLUMN_WIDTHS.map(width => ({ width }))

    // data
    rows.forEach((row, index) => {
        const excelRow = worksheet.getRow(4 + index)
        excelRow.values = [
            row.year || '',
            row.month || '',
            capitalize(row.db_name),
            row.employee_status || '',
            row.position_name || '',
            row.manager_dbname || '',
            (row.team_name || '').toUpperCase(),
            toNumber(row.performance),
            individualScoreOf(row),
            leadershipOf(row),
            toNumber(row.performance_score),
            toNumber(row.performance_rating),
            toNumber(row.absence_score),
            toNumber(row.tardiness_score),
            Number((toNumber(row.absence_rating) + toNumber(row.tardiness_rating)).toFixed(4)),
            toNumber(row.memo_score),
            toNumber(row.feedback_score),
            Number((toNumber(row.memo_rating) + toNumber(row.feedback_rating)).toFixed(4)),
            toNumber(row.final_ratings),
            row.ratings_name || '',
        ]

        excelRow.eachCell((cell, colNumber) => {
            cell.border = getDataBorder()
            cell.alignment = { horizontal: 'center', vertical: 'middle' }

            // EMPLOYEE STATUS
            if (colNumber === 4) {
                const color = cell.value === 'Resigned' ? 'DB211A' : '14DB3C'
                cell.font = { bold: true, color: { argb: color } }
            }

            // GRAND TOTAL
            if (colNumber === 19) {
                let fontColor = 'DB211A'
                if (cell.value >= 5) fontColor = '7414DB'
                else if (cell.value >= 4) fontColor = '0069DB'
                else if (cell.value >= 3) fontColor = '00DB4E'
                else if (cell.value >= 2) fontColor = 'D9BC4F'
                cell.font = { bold: true, color: { argb: fontColor } }
            }

            // RATING
            if (colNumber === 20) {
                const colors = RATING_COLORS[cell.value] || { fill: 'FFFFFF', font: '000000' }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } }
                cell.font = { bold: true, color: { argb: colors.font } }
            }
        })
    })
}

// shared with the agent performance export (agent_performance_export.js)
exports.excel = { writeTable, RATING_COLORS, capitalize, toNumber, COLUMN_GROUPS, leadershipOf, individualScoreOf }

exports.csdLeaderboardExportToExcel = async (req, res, next) => {
    const scope = req.params.scope

    if (!SCOPE_TITLES[scope]) {
        return res.status(400).json({ message: `Only ${Object.keys(SCOPE_TITLES).join(' and ')} can be exported` })
    }

    const department = readDepartment(req)
    if (!department) return badDepartment(res)

    try {
        const yearMonth = req.query.year_month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
        const { data, error } = await buildCsdLeaderboard(req.user, scope, yearMonth, null, department)

        if (error) return res.status(error.status).json({ message: error.message })
        if (data.length === 0) return res.status(404).json({ message: 'No data to export' })

        // The export does not wait for every row to be submitted any more (the file goes to the GOM): a row that is not submitted
        // keeps its incomplete rating, like the page. To be decided again with the quarterly rule of the leaders ("due this month").

        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet(`${data[0].month}-${data[0].year}-SCORE`)
        writeTable(data, worksheet, `${DEPARTMENT_LABELS[department]} ${SCOPE_TITLES[scope]}`)

        res.setHeader('Content-Disposition', `attachment; filename="${department}-${scope}-leaderboard-${yearMonth}.xlsx"`)
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

        await workbook.xlsx.write(res)
        res.end()

    } catch (error) {
        console.error('Error exporting the CSD leaderboard', error)
        res.status(500).json({ error: 'Error, Cannot export the CSD leaderboard' })
    }
}
