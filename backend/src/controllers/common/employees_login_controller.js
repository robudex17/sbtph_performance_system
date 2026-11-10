const pool =  require('../../config/db')

const { validationResult } = require('express-validator')
const bcyrpt = require('bcrypt')


const { headCanReceiveFeedback } = require('./feedback_office')
const { viewAllDepartmentsOf } = require('./view_access')
const { generateAccessToken,  decodedToken } = require('../../utils/generate_token')

exports.registerUser = async(req,res,next) => {
    console.log('the register body is ', req.body)
    const errors = validationResult(req)

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try{
        
        const { login_id, username, password, role, status} = req.body 
        

        // check if user already exist
    
        const [ userExists ] = await pool.execute('SELECT * FROM employees_login where login_id=?', [login_id])
    
        if( userExists.length > 0  && userExists){
            return res.status(400).json({'message': 'User already exists'})
        }
    
        const hashedPassowrd = await bcyrpt.hash(password, 10)

        const [ insertResult ] = await pool.execute(
                            `INSERT INTO employees_login (login_id, username, password_hash, status, role) 
                            VALUES(?, ? ,? , ? ,?) `, [login_id, username, hashedPassowrd,status, role])
                     
        if (insertResult.affectedRows === 1){
           return res.status(201).json({message: 'User registered successfully'})
        }
     
        
    }catch(error){
        console.log('There is an error in user registration', error)
       return res.status(400).json({ message: 'There is an error in user registration' });
    }
  
}


exports.updateLogin = async(req,res,next) => {
  
    const errors = validationResult(req)

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try{
        const { login_id, username, password, role, status} = req.body 
        
   
        if (password != "" ) {
            
            const hashedPassowrd = await bcyrpt.hash(password, 10)
            const [ result ] = await pool.execute(`UPDATE employees_login SET username=?, status=?, role=? , password_hash=? WHERE login_id=? `, 
                                      [username, status, role, hashedPassowrd, login_id ]

                                     )
             if (result.affectedRows === 0){
                    return res.status(400).json({message: 'Failed to update employee login'})
                }
        }else {
            console.log('I came here')
            const [ result ] = await pool.execute(`UPDATE employees_login SET username=?, status=?, role=?  WHERE login_id=? `, 
                [username, status, role,  login_id ]

               )
            if (result.affectedRows === 0){
                return res.status(400).json({message: 'Failed to update employee login'})
            }
        }
        
        res.status(201).json({
            message: `Employee Login is updated..`
        })
     
        
    }catch(error){
        console.log('Failed to update employee login', error)
       return res.status(400).json({ message: 'Failed to update employee login' });
    }
  
}

exports.loginUser = async(req,res, next) => {
    const errors = validationResult(req)

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
    }

    try{
       //find user
       const { username, password, loginas} = req.body
       
       console.log('the login body is ', req.body)

       const query = "SELECT * FROM employees_login WHERE username=?"
       const [loginUser] = await pool.execute(query, [username])
   
       if(!loginUser || !(await bcyrpt.compare(password, loginUser[0].password_hash))){
         return res.status(401).json({message: 'Invalid Credentials'})
       }

       if (loginUser[0].status === 'inactive' || loginUser[0].status === 'suspended'){
         return res.status(403).json({message: `Your account is ${loginUser[0].status} login is not allow`})
       }

       const loginId = loginUser[0].login_id



        const [user] = await pool.execute(
        `
            SELECT 
                e.id AS employee_id,
                e.id AS login_id,
                e.db_name,
                e.firstname,
                e.lastname,
                e.email,
                e.image_link,
                e.extension, 

                el.username,
              

                ea.id AS assignment_id,
                ea.manager_id,

                -- Position
                p.id AS position_id,
                p.position_name,
                p.level as position_level,

                -- System Role
                el.role, 
                el.status,

                -- Department
                d.id AS department_id,
                d.name AS department_name,
                d.code AS department_code,

                -- Manager info
                mgr.id AS manager_id,
                mgr.firstname AS manager_firstname,
                mgr.lastname AS manager_lastname,

                -- Market / Team
                m.id AS market_id,
                m.name AS market_name,
                t.id AS team_id,
                t.name AS team_name,

                -- Dates
                DATE_FORMAT(ea.effective_from, '%Y-%m-%d') AS effective_from,
                DATE_FORMAT(ea.effective_to, '%Y-%m-%d') AS effective_to,
                DATE_FORMAT(ee.start_date, '%Y-%m-%d') AS start_date,
                DATE_FORMAT(ee.end_date, '%Y-%m-%d') AS end_date,

                -- Employment Status Logic
                CASE  
                    WHEN ee.status = 'Hired' 
                        AND EXISTS (
                            SELECT 1
                            FROM employee_employments ee2
                            WHERE ee2.employee_id = e.id
                            AND ee2.status = 'Resigned'
                            AND ee2.id < ee.id
                        )
                    THEN 'Rehired'
                    ELSE ee.status
                END AS employee_status

            FROM employees e

            -- LOGIN TABLE
            LEFT JOIN employees_login el 
                ON e.id = el.login_id

       
           

            -- EMPLOYMENT HISTORY
            JOIN employee_employments ee 
                ON e.id = ee.employee_id

            -- ASSIGNMENT HISTORY
            JOIN employee_assignments ea 
                ON e.id = ea.employee_id
                AND (
                    (ee.end_date IS NULL AND ea.effective_from >= ee.start_date)
                    OR
                    (ee.end_date IS NOT NULL 
                    AND ea.effective_from BETWEEN ee.start_date AND ee.end_date)
                )

            -- POSITION
            LEFT JOIN positions p 
                ON ea.position_id = p.id

            -- DEPARTMENT
            LEFT JOIN departments d 
                ON ea.department_id = d.id

            -- MANAGER
            LEFT JOIN employees mgr 
                ON ea.manager_id = mgr.id

            -- MARKET / TEAM
            LEFT JOIN markets m 
                ON ea.market_id = m.id

            LEFT JOIN teams t 
                ON ea.team_id = t.id

            WHERE e.id = ?

            ORDER BY ea.effective_from DESC
        `,
        [loginId]
        )

       if(user[0].employee_status == 'Resigned'){
        return  res.status(401).json({message: `${user[0].firstname} ${user[0].lastname} is already Resigned. Resigned Staff is not allowed to login..`})
       }
        
  
    
       console.log('the user is ', user[0])


       // 'Login As GOM' is only for the GOM (position level 15), and the GOM logs in only as GOM (the same employees login, so the
       // GOM is not confused with the other choices)
       const isGomUser = Number(user[0].position_level) === 15
       if (loginas === 'gom' && !isGomUser){
         return res.status(401).json({message: 'Only the GOM can login as GOM'})
       }
       if (loginas !== 'gom' && isGomUser){
         return res.status(401).json({message: 'Please login as GOM'})
       }

       user[0].login_type = 'employee'

       // false when the office of the immediate head does not receive feedback (Japan): the menu hides FEEDBACK HEAD
       user[0].head_receives_feedback = user[0].manager_id ? await headCanReceiveFeedback(user[0].login_id, user[0].manager_id) : true

       // the departments where the person sees the whole department on the evaluation pages (evaluation_view_access)
       user[0].view_all_departments = await viewAllDepartmentsOf(user[0].login_id)




       const accessToken = generateAccessToken(user[0])

     return res.json({accessToken})

    }catch(error){
        console.log('User cannot login', error)
        return res.status(400).json({ message: 'There is an error in user login' })
    }
    
}


exports.logoutUser = async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken 
    // the logged in user (the route needs the token), never an id sent in the body
    const loginId = req.user.login_id
    try {
        if(!refreshToken){
            return res.status(400).json({message: 'No refresh token provided'})
        }
    
         //fetch and check the stored refresh token from database
         const [ storedToken ] = await pool.execute("SELECT * FROM refresh_tokens WHERE user_id=? AND revoked=0 LIMIT 1", [loginId])
    
         if (!storedToken || storedToken.length === 0){
           
            return res.status(403).json({message: 'Invalid refresh token, Token has been already revoked'})
        }
    
         
        // Revoke the token 
        // const [revokeToken ] = await pool.execute("UPDATE refresh_tokens SET revoked= TRUE WHERE user_id=?", [storedToken[0].user_id])
        
        //Delete token 
        const  [deleteToken] = await pool.execute("DELETE FROM refresh_tokens WHERE user_id=?", [loginId])

        if (deleteToken.affectedRows === 1){

            // Clear the refresh token cookie
            res.clearCookie('refreshToken');

            res.json({ message: 'Logged out successfully' });
        }

    }catch(error){
        console.log('Error in user logout', error)
        return res.status(403).json({message: 'There is an error in user logout'})
    }
    



}

// exports.verifyToken = async (req, res, next) => {
//     const token = req.body.token 

// }