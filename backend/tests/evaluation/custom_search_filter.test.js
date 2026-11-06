// Custom Search (sales): the table filter with several names, the sort by a column, and the Excel export that follows the filter.
jest.mock('../../src/config/db')
const fs = require('fs')
const path = require('path')
const pool = require('../../src/config/db')
const controller = require('../../src/controllers/custom_search_controller')

// ---------- the backend: filterIds (the Excel export sends the ids of the rows shown) ----------

const agentRow = (id, db_name, market_id, team_id, month = 'January') => ({
    id, db_name, market_id, market_name: `Market${market_id}`, team_id, team_name: `Team${team_id}`,
    agent_type: 0, month, year: 2026, target: 100, shipok: 50,
})

const allRows = [
    agentRow(1, 'Ana', 10, 1), agentRow(2, 'Bea', 10, 1), agentRow(3, 'Cid', 20, 2), agentRow(4, 'Dan', 30, 3),
]

const admin = { role: 'admin', login_type: 'standarduser', login_id: 99 }

const call = async (query, { exportToExcel = false } = {}) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()
    const req = { user: admin, query: { start_date: '2026-01', end_date: '2026-02', filterId: 'all', ...query }, export_to_excel: exportToExcel }
    await controller.fetchCustomSearch(req, res, next)
    return { res, req, next }
}

beforeEach(() => {
    pool.execute = jest.fn().mockImplementation(async () => [allRows.map(row => ({ ...row }))])
    pool.query = jest.fn().mockImplementation(async () => [allRows.map(row => ({ ...row }))])
})

const idsOf = (res) => res.json.mock.calls[0][0].map(row => row.id)

describe('custom search: who sees everybody', () => {
    const sqlOf = async (user) => {
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
        await controller.fetchCustomSearch({ user, query: { start_date: '2026-01', end_date: '2026-01', filterBy: 'individual', filterId: 'all' } }, res, jest.fn())
        return pool.execute.mock.calls.map(([sql]) => String(sql))
    }

    test('the GOM (level 15, employee login) is not limited to his own id', async () => {
        const sql = await sqlOf({ role: 'manager', login_type: 'employee', position_level: 15, login_id: 1 })
        expect(sql.length).toBeGreaterThan(0)
        expect(sql.some(text => text.includes('sa.id =?'))).toBe(false)
    })

    test('a sales agent still sees only his / her own', async () => {
        const sql = await sqlOf({ role: 'user', login_type: 'salesagentuser', agent_type: 0, position_level: 1, login_id: 5 })
        expect(sql.some(text => text.includes('sa.id =?'))).toBe(true)
    })
})

describe('custom search: filterIds', () => {
    test('no filterIds: every agent of every month of the range', async () => {
        const { res } = await call({ filterBy: 'individual' })
        expect(idsOf(res)).toEqual([1, 2, 3, 4, 1, 2, 3, 4])
    })

    test('several agents: only their rows, in every month', async () => {
        const { res } = await call({ filterBy: 'individual', filterIds: '2,4' })
        expect(idsOf(res)).toEqual([2, 4, 2, 4])
    })

    test('market: the market id; team: the team id', async () => {
        const market = await call({ filterBy: 'market', filterIds: '10' })
        expect(idsOf(market.res)).toEqual([1, 2, 1, 2])

        const team = await call({ filterBy: 'team', filterIds: '2,3' }, { exportToExcel: true })
        // the team view is grouped by the server: one group per team and month, only the chosen teams
        const groups = team.req.data
        expect(groups).toHaveLength(2)
        expect(groups[0].map(group => group.team_id).sort()).toEqual([2, 3])
    })

    test('the Excel export gets only the chosen rows', async () => {
        const { req, next } = await call({ filterBy: 'individual', filterIds: '1,3' }, { exportToExcel: true })
        expect(next).toHaveBeenCalled()
        expect(req.data.map(month => month.map(row => row.id))).toEqual([[1, 3], [1, 3]])
    })

    test('ids that exist nowhere: the export is refused with a message, nothing is built', async () => {
        const { res, next } = await call({ filterBy: 'individual', filterIds: '999' }, { exportToExcel: true })
        expect(res.status).toHaveBeenCalledWith(404)
        expect(next).not.toHaveBeenCalled()
    })
})

// ---------- the page: the filter of the table and the sort by a column ----------

const frontend = path.join(__dirname, '../../../frontend')
const read = (file) => fs.readFileSync(path.join(frontend, file), 'utf8').replace(/\r\n/g, '\n')
const page = read('pages/admin/target/custom_search/[search_type].vue')

// the Vue functions the code needs, as a small fake: ref, computed and watch are not needed for these checks
const fakeVue = () => ({
    ref: (value) => ({ value }),
    computed: (getter) => ({ get value() { return getter() } }),
})

const loadComposable = () => {
    const source = read('composables/useColumnSort.js').replace(/^import .*$/m, '').replace('export const', 'const') + '\nreturn useColumnSort'
    const { ref, computed } = fakeVue()
    return new Function('ref', 'computed', source)(ref, computed)
}

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const getWholeNumberPercentage = (target, shipok) =>
    (Number(target) != 0 && Number(shipok) != 0) ? Math.round(((shipok / target) * 100).toFixed(2)) + '%' : '0%'

// the filter and sort block of the page, run with a role, a filterBy and a list of rows
const loadPage = (rows, filterBy = 'individual') => {
    const { ref, computed } = fakeVue()
    const start = page.indexOf('const canFilter')
    const end = page.indexOf('const totalPages')
    const block = page.slice(start, end)
    const code = `${block}\nreturn { canFilter, searchText, selectedIds, filterOptions, optionsShown, filteredRows, isFiltered, exportQuery,
        selectShown, clearFilter, removeSelected, toggleSort, sortMark, sortedRows }`
    return new Function('ref', 'computed', 'isAdmin', 'currentUser', 'filterBy', 'data', 'query', 'months', 'getWholeNumberPercentage', 'useColumnSort', code)(
        ref, computed, ref(true), { agent_type: 1 }, ref(filterBy), ref(rows), ref({ start_date: '2026-01', end_date: '2026-02', filterBy, filterId: 'all' }),
        months, getWholeNumberPercentage, loadComposable()
    )
}

const names = (table) => table.sortedRows.value.map(row => row.db_name)

describe('custom search page: filter several names', () => {
    const rows = [
        ...allRows.map(row => ({ ...row })),
        ...allRows.map(row => ({ ...row, month: 'February', target: row.id * 10, shipok: 5 })),
    ]

    test('the options are every agent once, by name', () => {
        const table = loadPage(rows)
        expect(table.filterOptions.value.map(option => option.name)).toEqual(['Ana', 'Bea', 'Cid', 'Dan'])
    })

    test('several chosen names: only their rows (all months), and the export gets their ids', () => {
        const table = loadPage(rows)
        table.selectedIds.value = ['2', '4']
        expect(table.filteredRows.value.map(row => row.db_name)).toEqual(['Bea', 'Dan', 'Bea', 'Dan'])
        expect(table.exportQuery.value.filterIds).toBe('2,4')
        expect(table.exportQuery.value.filterBy).toBe('individual')
    })

    test('the search text narrows the rows and the options; the export follows it', () => {
        const table = loadPage(rows)
        table.searchText.value = 'an'
        expect(table.filteredRows.value.map(row => row.db_name)).toEqual(['Ana', 'Dan', 'Ana', 'Dan'])
        expect(table.optionsShown.value.map(option => option.name)).toEqual(['Ana', 'Dan'])
        expect(table.exportQuery.value.filterIds).toBe('1,4')

        table.selectShown()
        expect(table.selectedIds.value).toEqual(['1', '4'])
    })

    test('no filter: the export has no filterIds; clearing the filter goes back to everything', () => {
        const table = loadPage(rows)
        expect(table.isFiltered.value).toBe(false)
        expect(table.exportQuery.value.filterIds).toBeUndefined()

        table.selectedIds.value = ['1']
        table.searchText.value = 'x'
        table.clearFilter()
        expect(table.filteredRows.value).toHaveLength(8)
    })

    test('team and market filter by their own id and name; overall has no filter', () => {
        const team = loadPage(rows, 'team')
        expect(team.filterOptions.value.map(option => option.name)).toEqual(['Team1', 'Team2', 'Team3'])
        team.selectedIds.value = ['1']
        expect(team.filteredRows.value.map(row => row.db_name)).toEqual(['Ana', 'Bea', 'Ana', 'Bea'])

        const market = loadPage(rows, 'market')
        market.selectedIds.value = ['20', '30']
        expect(market.exportQuery.value.filterIds).toBe('20,30')   // the export sends the market ids of the rows
        expect(market.filteredRows.value.map(row => row.db_name)).toEqual(['Cid', 'Dan', 'Cid', 'Dan'])

        expect(loadPage(rows, 'overall').canFilter.value).toBe(false)
    })
})

describe('custom search page: sort by a column', () => {
    const rows = [
        { id: 1, db_name: 'Bea', month: 'February', year: 2026, target: 100, shipok: 50 },
        { id: 2, db_name: 'Ana', month: 'January', year: 2026, target: 20, shipok: 30 },
        { id: 3, db_name: 'Cid', month: 'December', year: 2025, target: 0, shipok: 0 },
    ]

    test('ascending, descending, then the original order; the list given is not changed', () => {
        const table = loadPage(rows)
        table.toggleSort('target')
        expect(names(table)).toEqual(['Cid', 'Ana', 'Bea'])
        expect(table.sortMark('target')).toBe('▲')
        table.toggleSort('target')
        expect(names(table)).toEqual(['Bea', 'Ana', 'Cid'])
        table.toggleSort('target')
        expect(names(table)).toEqual(['Bea', 'Ana', 'Cid'])
        expect(rows.map(row => row.db_name)).toEqual(['Bea', 'Ana', 'Cid'])
    })

    test('percentage, remaining units and the period (year first, then month)', () => {
        const table = loadPage(rows)
        table.toggleSort('percentage')
        expect(names(table)).toEqual(['Cid', 'Bea', 'Ana'])            // 0%, 50%, 150%
        table.toggleSort('remaining')
        expect(names(table)).toEqual(['Ana', 'Cid', 'Bea'])            // -10, 0, 50
        table.toggleSort('period')
        expect(names(table)).toEqual(['Cid', 'Ana', 'Bea'])            // Dec 2025, Jan 2026, Feb 2026
    })

    test('the sort works on the filtered rows', () => {
        const table = loadPage(rows)
        table.selectedIds.value = ['1', '2']
        table.toggleSort('db_name')
        expect(names(table)).toEqual(['Ana', 'Bea'])
    })
})

describe('custom search: the screens', () => {
    const navigation = read('components/NavigationBar.vue')

    test('the Value dropdown is gone from the search bar; the search always loads the whole range', () => {
        expect(navigation).not.toContain('id="filter-value"')
        expect(navigation).toMatch(/selectedFilterValue = ref\(''\)/)
    })

    test('100 rows per page, like the dashboard', () => {
        expect(page).toMatch(/itemsPerPage = ref\(100\)/)
    })

    test('the export gets the filter and every column header sorts', () => {
        expect(page).toContain(':query="exportQuery"')
        for (const key of ['id', 'db_name', 'market_name', 'team_name', 'period', 'target', 'shipok', 'percentage', 'remaining']) {
            expect(page).toContain(`@click="toggleSort('${key}')"`)
        }
        expect(page).toMatch(/useColumnSort\(filteredRows, sortValueOf\)/)
    })
})
