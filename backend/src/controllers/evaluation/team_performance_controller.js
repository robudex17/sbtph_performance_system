const { scoring, rankTeams } = require('./leaderboard_controller')
const { shared } = require('./agent_performance_controller')
const { readDepartment, badDepartment } = require('./department_scope')
const { canViewTeams } = require('./visibility_rules')

// Team Monthly / Team Yearly performance of the CSD teams (the "Team Performance" menu), same idea as the sales team pages.
// A team is the staff with the same team_id. The team rating is the average of the final ratings of its members:
//   monthly   all the members of the month; the team is INCOMPLETE RATING while one of them is not submitted
//             (the same rule as the Team board of the leaderboard)
//   yearly    all the SUBMITTED member-months of the year (only the submitted months count, like the sales yearly pages)
// The members are the ones the user may see (visibility_rules.js, canSee):
//   admin, poweruser, level 10 -> all the teams, level 9 -> the staff of level 1 - 9, level 8 and 7 -> their own team.
//   Position level 1, 2, 3 have no team performance.
//
// :team_id can be 'me': the team of the user (the page of a team leader).
// Monthly:  GET /evaluation/team_performance/monthly?year_month=YYYY-MM              the teams
//           GET /evaluation/team_performance/monthly/:team_id?year_month=...         one team with its members (an array of 0 or 1)
// Yearly:   GET /evaluation/team_performance/yearly?year=YYYY                        the teams
//           GET /evaluation/team_performance/yearly/:team_id?year=YYYY               one team: its months and its members (or null)

const { toNumber, round4, ratingName, loadScoreTables, INCOMPLETE } = scoring
const { scoreMonth, visibleOf, buildYear, yearAverage, readYear, currentYearMonth } = shared

const byLevelThenName = (a, b) => Number(b.position_level) - Number(a.position_level) || String(a.db_name).localeCompare(String(b.db_name))
const byRatingDesc = (a, b) => parseFloat(b.final_ratings) - parseFloat(a.final_ratings)

// the team leader: the highest position of the team (the first one by name when they are equal)
const leaderOf = (members) => [...members].sort(byLevelThenName)[0]

const average = (rows) => (rows.length ? rows.reduce((sum, row) => sum + toNumber(row.final_ratings), 0) / rows.length : 0)

// ---------------------------------------------------------------- monthly
const buildTeamsOfMonth = async (user, yearMonth, tables, department = 'csd') => {
    const month = await scoreMonth(user, yearMonth, tables, department)
    const rows = visibleOf(user, month)

    // the BEST TEAM is the one of the leaderboard, among ALL the teams: a team leader only sees his/her own team here
    const bestTeamIds = new Set(rankTeams(month.scored, tables).filter(team => team.tag).map(team => String(team.team_id)))

    const groups = new Map()
    for (const row of rows) {
        if (row.team_id == null) continue
        if (!groups.has(row.team_id)) groups.set(row.team_id, [])
        groups.get(row.team_id).push(row)
    }

    const teams = []
    for (const members of groups.values()) {
        const leader = leaderOf(members)
        const isCompleted = members.every(member => member.submitted === 1)
        const final = average(members)

        teams.push({
            team_id: leader.team_id,
            team_name: leader.team_name,
            team_leader_id: leader.id,
            team_leader_name: leader.db_name,
            team_image: leader.image_link,
            month: leader.month,
            year: leader.year,
            year_month: leader.year_month,
            members_count: members.length,
            isCompleted,
            final_ratings: round4(final),
            ratings_name: isCompleted ? ratingName(tables.ratings, parseFloat(round4(final))) : INCOMPLETE,
            teams: [...members].sort(byLevelThenName),
        })
    }

    return teams
        .map(team => ({ ...team, tag: bestTeamIds.has(String(team.team_id)) ? 'BEST TEAM' : '' }))
        .sort(byRatingDesc)
}

// teamId 'me': the team of the user (the page of a team leader opens it without choosing a team)
const pickTeam = (teams, teamId, user) => {
    if (!teamId) return teams
    if (teamId === 'me') return teams.filter(team => team.teams.some(member => Number(member.id) === Number(user?.login_id)))
    return teams.filter(team => String(team.team_id) === String(teamId))
}

exports.getTeamsMonthly = async (user, yearMonth, teamId, department = 'csd') => {
    const tables = await loadScoreTables()
    return pickTeam(await buildTeamsOfMonth(user, yearMonth, tables, department), teamId, user)
}

// ---------------------------------------------------------------- yearly
const buildTeamsOfYear = async (user, year, department = 'csd') => {
    const { tables, byEmployee } = await buildYear(user, year, department)

    // team -> { months: Map(year_month -> rows), members: Map(employee id -> rows of the employee in this team) }
    const teams = new Map()
    for (const records of byEmployee.values()) {
        for (const record of records) {
            if (record.team_id == null) continue
            if (!teams.has(record.team_id)) teams.set(record.team_id, { months: new Map(), members: new Map() })
            const team = teams.get(record.team_id)

            if (!team.months.has(record.year_month)) team.months.set(record.year_month, [])
            team.months.get(record.year_month).push(record)

            if (!team.members.has(record.id)) team.members.set(record.id, [])
            team.members.get(record.id).push(record)
        }
    }

    const result = []
    for (const team of teams.values()) {
        const allRows = [...team.months.values()].flat()
        const submittedRows = allRows.filter(row => row.submitted === 1)
        const latest = allRows[allRows.length - 1]
        const leader = leaderOf([...team.members.values()].map(rows => rows[rows.length - 1]))

        // one row per month that has submitted members
        const months = [...team.months.entries()]
            .map(([yearMonth, rows]) => {
                const submitted = rows.filter(row => row.submitted === 1)
                return {
                    year_month: yearMonth,
                    month: rows[0].month,
                    year: rows[0].year,
                    members_total: rows.length,
                    members_submitted: submitted.length,
                    isCompleted: submitted.length === rows.length,
                    final_ratings: round4(average(submitted)),
                    ratings_name: submitted.length ? ratingName(tables.ratings, parseFloat(round4(average(submitted)))) : 'No Ratings',
                }
            })
            .filter(month => month.members_submitted > 0)
            .sort((a, b) => a.year_month.localeCompare(b.year_month))

        const final = average(submittedRows)

        result.push({
            team_id: latest.team_id,
            team_name: latest.team_name,
            team_leader_id: leader.id,
            team_leader_name: leader.db_name,
            team_image: leader.image_link,
            year: Number(year),
            members_count: team.members.size,
            months_counted: months.length,
            final_ratings: round4(final),
            ratings_name: submittedRows.length ? ratingName(tables.ratings, parseFloat(round4(final))) : 'No Ratings',
            months,
            teams: [...team.members.values()]
                .map(rows => yearAverage(rows.filter(row => row.submitted === 1), rows, tables, year))
                .sort(byLevelThenName),
        })
    }

    return result.sort(byRatingDesc)
}

exports.getTeamsYearly = async (user, year, teamId, department = 'csd') => {
    return pickTeam(await buildTeamsOfYear(user, year, department), teamId, user)
}

// ---------------------------------------------------------------- routes
const denyWithoutTeams = (user, res, department) => {
    if (canViewTeams(user, department)) return false
    res.status(403).json({ message: 'Access Denied: no team performance for your position' })
    return true
}

exports.fetchMonthly = async (req, res) => {
    const department = readDepartment(req)
    if (denyWithoutTeams(req.user, res, department)) return
    if (!department) return badDepartment(res)

    const yearMonth = req.query.year_month || currentYearMonth()
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
        return res.status(400).json({ message: 'Invalid year_month format. Expected YYYY-MM' })
    }

    try {
        res.status(200).json(await exports.getTeamsMonthly(req.user, yearMonth, req.params.team_id, department))
    } catch (error) {
        console.error('Error fetching the CSD team performance', error)
        res.status(500).json({ error: 'Database Error, Cannot Fetch CSD team performance' })
    }
}

exports.fetchYearly = async (req, res) => {
    const department = readDepartment(req)
    if (denyWithoutTeams(req.user, res, department)) return
    if (!department) return badDepartment(res)

    const year = readYear(req)
    if (!year) return res.status(400).json({ message: 'Invalid year format. Expected YYYY' })

    try {
        const teams = await exports.getTeamsYearly(req.user, year, req.params.team_id, department)
        res.status(200).json(req.params.team_id ? (teams[0] ?? null) : teams)
    } catch (error) {
        console.error('Error fetching the CSD team performance', error)
        res.status(500).json({ error: 'Database Error, Cannot Fetch CSD team performance' })
    }
}
