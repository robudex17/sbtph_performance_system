// The view of the whole department (evaluation_view_access): a person, for example the senior team leader of Purchasing, sees what the
// manager sees on the Leaderboard details, the Agent Performance and the Team Performance, but only in the department of the permission.
// No database: the evaluation and the score tables are mocked.
jest.mock('../../src/config/db')
jest.mock('../../src/controllers/evaluation/evaluation_controller', () => ({ generateCsdEvaluation: jest.fn() }))

const paths = require('./paths')
const pool = require('../../src/config/db')
const jwt = require('jsonwebtoken')

const TABLES = {
    csd_performance_score: [{ min_value: 0, max_value: 100, score: 5, description: 'EXCEPTIONAL' }],
    absences_score: [], tardiness_score: [], memorandum_score: [],
    evaluation_criteria: [{ performance: 0.8, absence: 0.05, tardiness: 0.05, memorandum_recieved: 0.05, feedback: 0.05 }],
    result_ratings: [{ min_value: 5, ratings_name: 'EXCEPTIONAL' }, { min_value: 0, ratings_name: 'POOR' }],
}
let accessRows = []
let accessTableMissing = false
pool.execute.mockImplementation(async (sql, params) => {
    if (sql.includes('evaluation_view_access')) {
        if (accessTableMissing) throw new Error("Table 'evaluation_view_access' doesn't exist")
        return [accessRows.filter(row => row.employee_id === params[0])]
    }
    const table = Object.keys(TABLES).find(name => sql.includes(name))
    return [TABLES[table] ?? []]
})

const { generateCsdEvaluation } = require('../../src/controllers/evaluation/evaluation_controller')
const { canSee, canSeeDetails, canViewTeams } = require(paths.visibility)
const leaderboard = require(paths.leaderboard)
const agentPerformance = require('../../src/controllers/evaluation/agent_performance_controller')
const teamPerformance = require('../../src/controllers/evaluation/team_performance_controller')
const { viewAllDepartmentsOf } = require('../../src/controllers/common/view_access')
const { generateAccessToken } = require('../../src/utils/generate_token')

// ---------- the rules ----------

const TEAM = 100
const row = (id, position_level, team_id) => ({ id, position_level, team_id })
const OTHER_TEAM_AGENT = row(31, 1, 200)
const A_LEVEL_10 = row(33, 10, null)

const IVY = { role: 'user', login_id: 5, position_level: 8, department_code: 'purchasing', view_all_departments: ['purchasing'] }
const TEAM_LEADER = { role: 'user', login_id: 6, position_level: 8, department_code: 'purchasing' }

describe('visibility rules with the view of the whole department', () => {
    test('in the department of the permission: every row, every detail, the team pages (like the manager)', () => {
        expect(canSee(IVY, OTHER_TEAM_AGENT, TEAM, 'purchasing')).toBe(true)
        expect(canSee(IVY, A_LEVEL_10, TEAM, 'purchasing')).toBe(true)
        expect(canSeeDetails(IVY, OTHER_TEAM_AGENT, TEAM, 'purchasing')).toBe(true)
        expect(canViewTeams(IVY, 'purchasing')).toBe(true)
    })

    test('another department, or no department given: only what the level gives (the own team)', () => {
        expect(canSee(IVY, OTHER_TEAM_AGENT, TEAM, 'csd')).toBe(false)
        expect(canSee(IVY, OTHER_TEAM_AGENT, TEAM)).toBe(false)
        expect(canSeeDetails(IVY, OTHER_TEAM_AGENT, TEAM, 'collection')).toBe(false)
        expect(canSee(IVY, row(32, 1, TEAM), TEAM, 'csd')).toBe(true)          // her own team, as a team leader
    })

    test('without the permission nothing changes: a team leader sees the own team only', () => {
        expect(canSee(TEAM_LEADER, OTHER_TEAM_AGENT, TEAM, 'purchasing')).toBe(false)
        expect(canSeeDetails(TEAM_LEADER, OTHER_TEAM_AGENT, TEAM, 'purchasing')).toBe(false)
    })

    test('an agent with the permission opens the team pages of that department only', () => {
        const agent = { role: 'user', login_id: 7, position_level: 3, view_all_departments: ['collection'] }
        expect(canViewTeams(agent, 'collection')).toBe(true)
        expect(canViewTeams(agent, 'purchasing')).toBe(false)
        expect(canViewTeams({ role: 'user', login_id: 8, position_level: 3 }, 'collection')).toBe(false)
    })

    test('a person can have several departments; a text that is not a list gives nothing', () => {
        const both = { role: 'user', login_id: 9, position_level: 8, view_all_departments: ['csd', 'collection'] }
        expect(canSee(both, OTHER_TEAM_AGENT, TEAM, 'csd')).toBe(true)
        expect(canSee(both, OTHER_TEAM_AGENT, TEAM, 'collection')).toBe(true)
        expect(canSee(both, OTHER_TEAM_AGENT, TEAM, 'purchasing')).toBe(false)
        expect(canSee({ ...both, view_all_departments: 'purchasing' }, OTHER_TEAM_AGENT, TEAM, 'purchasing')).toBe(false)
    })
})

// ---------- the login: the departments are read from the table and put in the token ----------

describe('the login', () => {
    test('the departments of the person, in lower case; nobody else is affected', async () => {
        accessRows = [{ employee_id: 5, department_code: 'Purchasing' }, { employee_id: 5, department_code: 'csd' }, { employee_id: 6, department_code: 'hradmin' }]
        expect(await viewAllDepartmentsOf(5)).toEqual(['purchasing', 'csd'])
        expect(await viewAllDepartmentsOf(99)).toEqual([])
    })

    test('the table is not created yet: no access, the login does not fail', async () => {
        accessTableMissing = true
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})
        expect(await viewAllDepartmentsOf(5)).toEqual([])
        quiet.mockRestore()
        accessTableMissing = false
    })

    test('the token carries the list', () => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
        const token = generateAccessToken({ login_id: 5, role: 'user', position_level: 8, view_all_departments: ['purchasing'] })
        expect(jwt.verify(token, process.env.JWT_SECRET).view_all_departments).toEqual(['purchasing'])
    })
})

// ---------- the pages ----------

const evaluationRow = (id, team_id, position_level) => ({
    id, db_name: `emp${id}`, team_id, team_name: `Team ${team_id}`, position_level, submitted: 1, performance: 90,
    month: 'October', year: 2026, year_month: '2026-10', image_link: null,
    absences: 0, tardiness: 0, memo: 0, feedback_by_admin: 5,
    feedback_by_qa: 0, feedback_by_immediate_head: 0, feedback_by_members: 0, leadership_required: false, leadership_score: 0,
})

// team 1: Ivy (8) and an agent. team 2: Raymond (8) and an agent. Kishi (10) has no team.
const evaluation = () => [
    evaluationRow(5, 1, 8), evaluationRow(11, 1, 1),
    evaluationRow(20, 2, 8), evaluationRow(21, 2, 1),
    evaluationRow(30, null, 10),
]
beforeEach(() => { generateCsdEvaluation.mockImplementation(async () => evaluation()) })

const ids = (rows) => rows.map(item => Number(item.id)).sort((a, b) => a - b)

describe('Agent Performance', () => {
    test('with the permission she sees everybody of Purchasing, without it only her own team', async () => {
        expect(ids(await agentPerformance.getMonthlyList(IVY, '2026-10', 'purchasing'))).toEqual([5, 11, 20, 21, 30])
        expect(ids(await agentPerformance.getMonthlyList({ ...IVY, view_all_departments: [] }, '2026-10', 'purchasing'))).toEqual([5, 11])
    })

    test('a permission for another department gives nothing here', async () => {
        expect(ids(await agentPerformance.getMonthlyList({ ...IVY, view_all_departments: ['csd'] }, '2026-10', 'purchasing'))).toEqual([5, 11])
    })

    test('the details of another employee open (the Agent Performance page of one employee)', async () => {
        const raymond = await agentPerformance.getMonthlyOne(IVY, '2026-10', 20, 'purchasing')
        expect(raymond?.id).toBe(20)
    })
})

describe('Team Performance', () => {
    test('with the permission she sees every team', async () => {
        const teams = await teamPerformance.getTeamsMonthly(IVY, '2026-10', undefined, 'purchasing')
        expect(teams.map(team => Number(team.team_id)).sort()).toEqual([1, 2])
    })

    test('the pages open for her, and stay closed for an agent without the permission', async () => {
        const call = async (user) => {
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), locals: {} }
            await teamPerformance.fetchMonthly({ user, query: { department: 'purchasing', year_month: '2026-10' }, params: {}, res }, res)
            return res.status.mock.calls[0][0]
        }
        const agent = { role: 'user', login_id: 21, position_level: 1, department_code: 'purchasing' }
        expect(await call(agent)).toBe(403)
        expect(await call({ ...agent, view_all_departments: ['purchasing'] })).toBe(200)
        expect(await call({ ...agent, view_all_departments: ['csd'] })).toBe(403)
    })
})

describe('Leaderboard', () => {
    test('the details of the other teams are open for her, closed for a normal team leader', async () => {
        const withAccess = await leaderboard.buildCsdLeaderboard(IVY, 'agent', '2026-10', null, 'purchasing')
        const without = await leaderboard.buildCsdLeaderboard(TEAM_LEADER, 'agent', '2026-10', null, 'purchasing')
        const other = (result) => result.data.find(item => Number(item.id) === 21)

        expect(other(withAccess).can_view_details).toBe(true)
        expect(other(without).can_view_details).toBe(false)
    })
})
