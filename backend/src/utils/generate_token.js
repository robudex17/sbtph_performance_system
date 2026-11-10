const jwt = require('jsonwebtoken')
// const { refreshToken } = require('../controllers/sales_login_controller')

exports.generateAccessToken = (user) => {
    const {username, role, login_id, login_type, manager_id, team_id, market_id, agent_type, db_name, firstname, lastname, image_link,email, position_name, position_level, position_id, department_id, department_code, department_name, head_receives_feedback, viewer_departments} = user
    return jwt.sign({ username, role, login_id, login_type, manager_id, team_id, market_id, agent_type, db_name, firstname, lastname, image_link,email,position_name, position_level, position_id,department_id, department_code, department_name, head_receives_feedback, viewer_departments
    },
      process.env.JWT_SECRET,{ expiresIn: '1d'}
    )
}

// exports.generateRefreshToken = (user) => {
//     return jwt.sign(
//         { username: user.username, role: user.role, login_id: user.login_id, 
//             manager_id: user.manager_id, agent_type: user.agent_type, firstname: user.firstname, 
//             lastname: user.lastname, db_name: user.db_name, market_id: user.market_id
//         }, 
//         process.env.JWT_REFRESH_SECRET, { expiresIn: '7d'}

//     )
// }

exports.decodedToken = (refreshToken) => {
    return  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
}