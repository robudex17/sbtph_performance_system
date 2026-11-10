// The Excel of the monthly Agent Performance and of the Leaderboard is built also when some rows are not submitted yet
// (the file goes to the GOM). A row not submitted keeps its incomplete rating. The data is mocked.
jest.mock('../../src/controllers/evaluation/agent_performance_controller', () => ({
    getMonthlyList: jest.fn(), getMonthlyOne: jest.fn(), getYearlyList: jest.fn(), getYearlyOne: jest.fn(),
}))
jest.mock('../../src/controllers/evaluation/leaderboard_controller', () => ({ buildCsdLeaderboard: jest.fn() }))

const { PassThrough } = require('stream')
const ExcelJS = require('exceljs')
const agentPerformance = require('../../src/controllers/evaluation/agent_performance_controller')
const leaderboard = require('../../src/controllers/evaluation/leaderboard_controller')
const { exportMonthly } = require('../../src/controllers/evaluation/agent_performance_export')
const { csdLeaderboardExportToExcel } = require('../../src/controllers/evaluation/leaderboard_export')

const makeResponse = () => {
    const stream = new PassThrough()
    const chunks = []
    stream.on('data', chunk => chunks.push(chunk))
    stream.headers = {}
    stream.setHeader = (key, value) => { stream.headers[key] = value }
    stream.status = (code) => { stream.code = code; return stream }
    stream.json = (body) => { stream.body = body; return stream }
    stream.bytes = () => Buffer.concat(chunks)
    return stream
}

const scoredRow = (id, db_name, submitted, position_level = 1) => ({
    id, db_name, submitted, position_level, position_name: 'Agent', team_name: 'Team A', employee_status: 'Hired',
    month: 'October', year: 2026, year_month: '2026-10', performance: 90, absences: 0, tardiness: 0, memo: 0,
    feedback_by_admin: 5, feedback_by_qa: 0, feedback_by_immediate_head: 0, feedback_by_members: 0,
    leadership_required: false, leadership_score: 0, final_ratings: submitted === 1 ? '4.5000' : 'INCOMPLETE RATING',
    ratings_name: submitted === 1 ? 'VERY SATISFACTORY' : 'INCOMPLETE RATING',
})

// a leader whose quarterly evaluation is not done yet next to a submitted agent
const rows = () => [scoredRow(1, 'ana', 1), scoredRow(2, 'leader', 0, 8)]

const admin = { role: 'admin', login_id: 1 }
const loaded = async (res) => {
    await new Promise(resolve => setImmediate(resolve))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(res.bytes())
    return workbook
}

beforeEach(() => jest.clearAllMocks())

describe('the Excel with rows that are not submitted', () => {
    test('Agent Performance Monthly: the file is built with every row', async () => {
        agentPerformance.getMonthlyList.mockResolvedValue(rows())
        const res = makeResponse()
        await exportMonthly({ user: admin, params: {}, query: { year_month: '2026-10' } }, res)

        expect(res.code).toBeUndefined()                                   // no 400: nothing was refused
        const sheet = (await loaded(res)).worksheets[0]
        expect(sheet.rowCount).toBeGreaterThanOrEqual(4)                   // the title, the header and the two rows
        const text = JSON.stringify(sheet.getSheetValues())
        expect(text).toContain('Ana')
        expect(text).toContain('Leader')
    })

    test('Agent Performance Monthly of one employee that is not submitted: the file is built', async () => {
        agentPerformance.getMonthlyOne.mockResolvedValue(scoredRow(2, 'leader', 0, 8))
        const res = makeResponse()
        await exportMonthly({ user: admin, params: { employee_id: '2' }, query: { year_month: '2026-10' } }, res)

        expect(res.code).toBeUndefined()
        expect((await loaded(res)).worksheets.length).toBeGreaterThan(0)
    })

    test('Leaderboard: the file is built with every row', async () => {
        leaderboard.buildCsdLeaderboard.mockResolvedValue({ data: rows() })
        const res = makeResponse()
        await csdLeaderboardExportToExcel({ user: admin, params: { scope: 'agent' }, query: { year_month: '2026-10' } }, res)

        expect(res.code).toBeUndefined()
        const text = JSON.stringify((await loaded(res)).worksheets[0].getSheetValues())
        expect(text).toContain('Ana')
        expect(text).toContain('Leader')
    })

    test('nothing to export is still a 404 message', async () => {
        agentPerformance.getMonthlyList.mockResolvedValue([])
        const res = makeResponse()
        await exportMonthly({ user: admin, params: {}, query: { year_month: '2026-10' } }, res)
        expect(res.code).toBe(404)
    })
})

describe('the pages do not block the export either', () => {
    const fs = require('fs')
    const path = require('path')
    const read = (file) => fs.readFileSync(path.join(__dirname, '../../../frontend/pages/csd', file), 'utf8')

    test('the export button gets incomplete = false and the single employee is always exportable', () => {
        expect(read('agent_performance/monthly.vue')).toContain(':incomplete="false"')
        expect(read('index.vue')).toMatch(/:token="token"\s+:incomplete="false"/)
        const month = read('agent_performance/month.vue')
        expect(month).toContain(':submitted="1"')
        expect(month).toContain(':incomplete="false"')
    })
})
