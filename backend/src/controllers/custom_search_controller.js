const pool = require('../config/db')
const { validationResult} = require('express-validator')

const { monthMap, monthNames } = require('./helper_scripts/global_variables_and_functions')

const sqlQueries = require('../sql/sql')


exports.fetchCustomSearch = async (req,res, next ) => {

   const startDate = req.query.start_date 
   const endDate = req.query.end_date 
   const current = new Date()

   
   let filterId

    const filterBy = req.query.filterBy 
  //  const filterId = req.query.filterId == 'all' ? "" : req.query.filterId

   const loginUser = req.user 
   
   //  filterId  in the query if the login user are admin , poweruser or agent_type = 2
   // the GOM (position level 15, view only) sees everybody like the admin; the others only their own team / market / agent
   const isGom = Number(loginUser.position_level) === 15
   if (loginUser.role != 'admin' && loginUser.role != 'poweruser'  && loginUser.agent_type !== 2 && !isGom){
       
        switch(filterBy){
          case "team":
            filterId = loginUser.team_id
            break
          case "market": 
            filterId = loginUser.market_id 
            break  
          case "agent": 
          case "lms" :
          case "individual":
            filterId = loginUser.login_id
            break  
          case "overall":
            filterId = ""
            break
          default: 
            filterId = ""  
        }
     
   }else {
      filterId = req.query.filterId == 'all' ? "" : req.query.filterId
   }



 
 
   //validation 
   if(!startDate || !endDate){
     return res.status(400).json({error: "start_date and end_date are required in YYYY-MM format." })
   }

   const start = new Date(`${startDate}-01`);
   const end = new Date(`${endDate}-01`);

  if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM." });
  }

  if (start > end) {
      console.log('start_date cannot be after end_date.')
      return res.status(400).json({ error: "start_date cannot be after end_date." });
  }

      // 2️⃣ End month should not exceed the current month
    //    (Optional — remove if you allow future months)
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of current month
    console.log(current.getMonth())
   if (end > currentMonth) {
        console.log("Range cannot go beyond the current month.")
        return { valid: false, message: "Range cannot go beyond the current month." };
    }

    // ✅ Generate all months between start and end
    const getMonthsInRange = (start, end) => {
    const months = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, '0');
        months.push(`${year}-${month}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
    };

    const monthRange = getMonthsInRange(start, end);

    console.log('Month range:', monthRange);

    let customSearchQuery = sqlQueries.dashboarddMasterQuery

    const fetchIndividualTargetShipok = async(id,query, month, year) => {
        const monthNumber = monthMap[month];
        const snapshot = `${year}-${monthNumber.toString().padStart(2, '0')}`;  
        let individualTargets
        
        if(id != ""){
            const [result] = await pool.execute(
                query,
                 [ month, year,snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, month, year, id]
              )   
                individualTargets  = result              
        }else{
            const [result] = await pool.execute(
                    query,
                    [ month, year,snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, month, year]
                )

                const arranged = [
                ...result.filter(a => a.market_name.toLowerCase() !== 'trucks'),
                ...result.filter(a => a.market_name.toLowerCase() === 'trucks')
                ]

              individualTargets  = arranged
        }

        return individualTargets

   }


   
   const groupedBy = (result,month, year, groupType) => {
             
        let team_targets = result.reduce((acc, agent) => {

        const teamId = agent.team_id 
            
                
                //this section I use market_name as team_name if  more than one market in a team I 
                //will combine it with this format  'market1/market2'
                if(!acc[teamId]){
                    acc[teamId] = {
                        team_name: agent.team_name,
                        team_id: teamId,
                        martket_id: agent.market_id,
                        market_name: agent.market_name,
                        month: month,
                        year: year,
                        shipok: 0,
                        target: 0,
                       
                        teammembers:[]

                    }
                }

                if(acc[teamId.team_name != agent.market_name]){
                    acc[teamId].team_name = `${acc[teamId].team_name}/${agent.market_name}`
                }

                acc[teamId].target  +=  Number(agent.target || 0 )
                acc[teamId].shipok  +=  Number(agent.shipok || 0)
            

                acc[teamId].teammembers.push(agent)

                return acc

           }, {}) 


            //get the values only
            team_targets = Object.values(team_targets)

           if(groupType == 'overall'){
              let overAllTargets = []
              //get the truck market team 
              truckTeam = team_targets.filter(team => team.team_id === 5)
              
              overAllTargets = team_targets.map(({ teammembers, ...rest}) => rest).reduce((acc, team) => {
                  let overTeam = 'overall'
                
                  if(!acc[overTeam]){
                    acc[overTeam] = {
                        month: month, 
                        year: year,
                        target: 0, //Number(team.total_target || 0),
                        shipok: 0, //Number(team.total_shipok || 0),
                        team_name: 'overll team',
                        market_name: 'overall market',
                        teammembers: [],
                    }
                  
                  }
                  acc[overTeam].target += Number(team.target || 0)
                  acc[overTeam].shipok += Number(team.shipok || 0) 
                  acc[overTeam].teammembers.push(team)
                  // acc[overTeam].target_without_trucks =  acc[overTeam].target - truckTeam[0].target
                  // acc[overTeam].shipok_without_trucks =  acc[overTeam].shipok - truckTeam[0].shipok

                  return acc
              },{})

              const key = 'overall'
              const truck =  truckTeam[0] || { target: 0, shipok: 0}

              overAllTargets[key].target_without_trucks  =  overAllTargets[key].target - Number(truck.target)
              overAllTargets[key].shipok_without_trucks = overAllTargets[key].shipok - Number(truck.shipok)

              overAllTargets = Object.values(overAllTargets)

              return overAllTargets

           }

            const arrangedTeamTargets = [
                ...team_targets.filter(a => a.market_name.toLowerCase() !== 'trucks'),
                ...team_targets.filter(a => a.market_name.toLowerCase() === 'trucks')
            ]


            return arrangedTeamTargets
    }


   const monthsToProcess = getMonthsInRange(start, end)
   let searchResult = []
   
   if((filterBy == 'agent' || filterBy == 'lms' || filterBy == 'individual') && filterId != ""){
        console.log('agent and lm must go here')
        customSearchQuery = `${customSearchQuery} AND sa.id =?`
 
      }else if(filterBy == 'team' && filterId != ""){
      customSearchQuery = `${customSearchQuery} AND t.id =?`
   }

   else if(filterBy == 'market' && filterId != ""){
      customSearchQuery = `${customSearchQuery} AND m.id =?`
   }
   
   else if (filterBy == 'agent'){
     customSearchQuery = `${customSearchQuery} AND aa.agent_type = 0`
   }else if(filterBy == 'lms'){
         customSearchQuery = `${customSearchQuery} AND   r.role_name = 'Local Manager'`
   }


   const monthQueries = monthsToProcess.map(snapshot => {
         const [year, month] = snapshot.split("-");
        
         return fetchIndividualTargetShipok(filterId, `${customSearchQuery} ORDER BY t.id ASC;` , monthNames[month - 1], year);
        //  return fetchIndividualTargetShipok(agent_id, `${customSearchQuery} AND sa.id=?` , monthNames[month - 1], year);
    });
    let monthResults = await Promise.all(monthQueries);

    // The table filter of the page (one or several names): only the rows of the chosen ids, so the Excel file has the rows of the table.
    // individual / agent / lms: the agent id, market: the market id, team: the team id. Nothing chosen = everything of the range.
    const selectedIds = String(req.query.filterIds || '').split(',').map(id => id.trim()).filter(id => id !== '')
    const selectedField = { individual: 'id', agent: 'id', lms: 'id', market: 'market_id', team: 'team_id' }[filterBy]
    if (selectedIds.length > 0 && selectedField) {
        // a month without a chosen row is dropped (the Excel and the groups need at least one row in a month)
        monthResults = monthResults
            .map(rows => rows.filter(row => selectedIds.includes(String(row[selectedField]))))
            .filter(rows => rows.length > 0)

        if (monthResults.length === 0 && req.export_to_excel) {
            return res.status(404).json({ message: 'No data for the selected filter' })
        }
    }

  
     //if team and overall combine group it 
     let groups = []
     if(filterBy == 'team' || filterBy == 'overall'){
        
        monthResults.forEach(monthYearResult => {
             let group = groupedBy(monthYearResult, monthYearResult[0].month, monthYearResult[0].year, filterBy)
             groups.push(group)
        })
           // Flatten results
        groups.forEach(result => searchResult.push(...result))
      }
     else{
        monthResults.forEach(result =>  searchResult.push(...result))  
        //for export to excel dont need to flat the result let the export to excel controller handel it
      
       
     }
     
    if(req.export_to_excel){
          console.log(req.export_to_excel)
          req.filterBy = filterBy
          filterBy == 'team' || filterBy == 'overall' ? req.data = groups  : req.data = monthResults
          
          next()
        }else{
             return res.status(200).json(searchResult);
          
        }
   

}