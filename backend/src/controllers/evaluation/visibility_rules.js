// WHO SEES WHAT in the evaluation pages: the leaderboard, the Agent Performance and the Team Performance. The rules live here, in one place.
//
//   who                               rows of the list (canSee)          details: metrics, scores, feedback (canSeeDetails)
//   admin, poweruser, GOM (level 15)  everybody                          everybody
//   manager (level 10)                everybody                          everybody
//   assistant manager (level 9)       the staff of level 9 and below     everybody
//   team leader / assistant TL (8, 7) the own team                       the own team
//   agent (1, 2, 3)                   only himself / herself             only himself / herself
//   a person with the view of the whole department (table evaluation_view_access): like the manager (level 10), but only in THAT
//   department. Nothing else of the person changes (title, leadership form, Performance, feedback).
//
// Everybody always sees himself / herself. ownTeamId is the team of the user in that month: it is read from his/her own row of the
// evaluation, NOT from the login token (the employee login reads the team from the sales table, so the team of the token can be empty or wrong).
// The ranking itself is public: only the details are hidden (see limitDetails in leaderboard_controller.js).
const { isFullViewer } = require('./department_scope')

const levelOf = (user) => Number(user?.position_level)
const isHimself = (user, row) => Number(row.id) === Number(user?.login_id)
const inOwnTeam = (row, ownTeamId) => row.team_id != null && ownTeamId != null && Number(row.team_id) === Number(ownTeamId)

// The view of the whole department is given person by person and department by department (table evaluation_view_access). The login
// puts the departments in the token (view_all_departments). Without the department of the request the answer is always no.
const viewsWholeDepartment = (user, department) =>
    Boolean(department) && Array.isArray(user?.view_all_departments) && user.view_all_departments.includes(department)

// the rows of the lists (Agent Performance and the others) that the user may see
exports.canSee = (user, row, ownTeamId, department) => {
    if (isFullViewer(user) || viewsWholeDepartment(user, department)) return true
    if (isHimself(user, row)) return true
    const level = levelOf(user)
    if (level === 10) return true
    if (level === 9) return Number(row.position_level) <= 9
    if (level === 8 || level === 7) return inOwnTeam(row, ownTeamId)
    return false
}

// the details of a row of the leaderboard (the metrics, the scores and the feedback)
exports.canSeeDetails = (user, row, ownTeamId, department) => {
    if (isFullViewer(user) || viewsWholeDepartment(user, department)) return true
    const level = levelOf(user)
    if (level === 10 || level === 9) return true
    if (isHimself(user, row)) return true
    return (level === 8 || level === 7) && inOwnTeam(row, ownTeamId)
}

// who opens the Team Performance pages (the others only see the team they belong to)
const TEAM_LEVELS = [10, 9, 8, 7]
exports.canViewTeams = (user, department) => isFullViewer(user) || viewsWholeDepartment(user, department) || TEAM_LEVELS.includes(levelOf(user))
exports.viewsWholeDepartment = viewsWholeDepartment
