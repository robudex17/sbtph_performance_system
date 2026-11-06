<template>
    <div>
        <header class="w-full bg-white shadow-md flex items-center justify-between px-6 py-4 fixed">
          <!-- Brand -->
          <div class="flex items-center gap-10">
              <div class="text-lg font-bold">SBTPH SALES APP</div>
              <!-- Dropdown for manage sales agent -->
              <div v-if="route.path =='/admin/agent2/manage_sales_agents'" class="flex items-center gap-2">
         
                <select 
                  class="px-2 py-1 border  font-bold text-sm rounded bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                 v-model="salesEmployementStatus"
                >
              
                <option class="text-green-500 font-bold" value="Hired">ACTIVE</option>
                <option  class="text-red-500 font-bold" value="Resigned">RESIGNED</option>

                </select>
                <button  
                  class="px-2 py-1 bg-blue-500 text-white rounded font-bold text-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  @click="fetchSalesAgents"
                >
                  Submit
                </button>
              </div>                 

              <!-- Dropdown for Dashboard -->
              <div v-if="route.path =='/dashboard'" class="flex items-center gap-2">
         
                <select 
                  class="p-2 border rounded bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  v-model="dashboardOption"
                >
              
                <option v-for="dashboardoption in dashboardListOfOptions " :key="dashboardoption" :value="dashboardoption ">{{ dashboardoption.toUpperCase()  }}</option>

                </select>
                <button  
                  class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  @click="submitDateSelection"
                >
                  Submit
                </button>
              </div>                 
              <!-- Dropdown for Month and Year -->
              <div v-else class="flex items-center gap-2">
                <select v-if="hasMonthOption"
                  v-model="selectedMonth"
                  class="p-2 border rounded bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option disabled value="" >Select Month</option>
                  <option v-for="month in months" :key="month" :value="month">{{ month }}</option>
                </select>
                <select v-if="hasYearOption" 
                  v-model="selectedYear"
                  class="p-2 border rounded bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option disabled value="">Select Year</option>
                  <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
                </select>

                <select v-if="hasTrucksOption"
                  class="p-2 border rounded bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  v-model="truckOption"
                >
                  <option :value="true">With Trucks</option>
                  <option :value="false">Without Trucks</option>
                </select>
                <select v-if="route.path == '/'"
                  class="p-2 border rounded bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  v-model="leaderboardOption"
                >
              
                <option v-for="leaderboardOptions in ['agent', 'lm', 'team', 'new deposit', 'shipok percentage']" :key="leaderboardOptions" :value="leaderboardOptions">{{ leaderboardOptions.toUpperCase()  }}</option>

                </select>
                <button  v-if="hasYearOption" 
                  class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  @click="submitDateSelection"
                >
                  Submit
                </button>
              </div>
              <div
                v-if="hasCustomSearchOption"
                class="flex flex-col sm:flex-row items-center gap-4"
              >
                <!-- Filter By Dropdown -->
                <div class="flex items-center gap-2" v-if="data?.length > 0">
                
                  <label for="filter-by" class="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Filter By:
                  </label>
                  <select
                    id="filter-by"
                    v-model="selectedFilter"
                    @change="fetchFilterValues"
                    class="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option v-for="item in filterBy" :key="item" :value="item">
                      {{ item.toUpperCase() }}
                    </option>
                  </select>
                </div>

                <!-- The name / team / market is chosen on the table of the page (several at once, no new search): the search always loads
                     the whole range, selectedFilterValue stays 'all' -->

                <!-- Start Date -->
                <div class="flex items-center gap-2">
                  <label for="start-date" class="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Start Date:
                  </label>
                  <input
                    id="start-date"
                    type="month"
                    v-model="selectStartDate"
                    class="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                <!-- End Date -->
                <div class="flex items-center gap-2">
                  <label for="end-date" class="text-sm font-medium text-gray-700 whitespace-nowrap">
                    End Date:
                  </label>
                  <input
                    id="end-date"
                    type="month"
                    v-model="selectEndDate"
                    class="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                <!-- Submit Button -->
                <button
                  class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  @click="submitCustomSearchSelection"
                >
                  Submit
                </button>

                <button 
                  class="px-4 py-2 ml-0 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  @click="reset"
                >
                  Reset
                </button>
              </div>
          </div>

                <!-- User Profile -->
            <div class="relative flex items-center gap-2 cursor-pointer group">
              <p>
              <span class="font-semibold text-gray-700">Current User: </span>
              <span class="font-bold text-purple-800 uppercase"> {{ currentUser.username }}</span>
            
               </p> 
              <img 
                    :src="updateImageLink(currentUser.image_link)" 
                    alt="User Profile" 
                    class="w-10 h-10 rounded-full border-2 border-gray-300"
                />
          </div>

            <!-- Actions -->
            <div class="flex items-center gap-6">
                <button @click="toggleTheme">
                  <i class="fas fa-adjust"></i>
                </button>
                <button @click="toggleViewMode">
                  <i class="fas" :class="viewMode === 'card' ? 'fa-th' : 'fa-table'"></i>
                </button>
                <div class="relative">
                  <button @click="toggleNotifications">
                    <i class="fas fa-bell"></i>
                    <span v-if="notifications.length" class="text-sm text-red-500">
                      {{ notifications.length }}
                    </span>
                  </button>
                  <div
                    v-if="showNotifications"
                    class="absolute right-0 bg-white shadow-lg rounded p-4 w-64"
                  >
                    <p v-if="!notifications.length">No notifications</p>
                    <ul>
                      <li v-for="notification in notifications" :key="notification.id">
                        {{ notification.message }}
                      </li>
                    </ul>
                  </div>
                </div>
                <button>
                  <i class="fas fa-user-circle"></i>
                </button>
            </div>
        </header>
    </div>
</template>

<script setup>
    import { ref, watch,computed } from "vue";
    import API from "~/utils/api"

    
    import { months, monthMap } from '@/utils/constants'

    import { isValidMonthRange } from '~/utils/validation_script'

    //get the current user
    const authStore = useAuthStore()
    authStore.fetchTokenFromLocalStore()

    const currentUser = authStore.state.user 
    const test = "rogmer"

    const config = useRuntimeConfig()

    const updateImageLink = (imageLink) => {
        return `${config.public.imageBaseUrl}${imageLink}`
      }

    const searchQuery = ref("");
    const notifications = [
      { id: 1, message: "John Doe reached his sales target!" },
      { id: 2, message: "New sales report available." },
    ];

    const showNotifications = ref(false);
    const viewMode = ref("card");
    const selectedMonth = ref("");
    const selectedYear = ref("");
    const truckOption = ref(true) //default is  include the truck 
    const router = useRouter()
    const route = useRoute()
    const urlPath = ref(route.fullPath)
    const selectStartDate = ref("")
    const selectEndDate = ref("")

    const  filterBy = ref([])
    const selectedFilterValue = ref('')


    // const filterBy = ref([
    //   'lms','agent', 'individual','market', 'team'
    // ])

    // the GOM (position level 15) searches everybody like the admin
    if (currentUser.role != 'admin' && currentUser.role != 'poweruser' && currentUser.agent_type !=2 && Number(currentUser.position_level) !== 15){
      filterBy.value = [ 'individual', 'team', 'overall']
      
     
    }else {
     
      filterBy.value = ['lms','agent', 'individual','market', 'team', 'overall']
      selectedFilterValue.value = 'all'
    }


    const selectedFilter = ref('individual') // Default selected
    // const selectedFilterValue = ref('all') // Default "All"
    // const filterValueList = ref([]) // Data fetched from API

        // Stores
    const customSeachStore = useCustomSearchStore() 
    const data = computed(() => customSeachStore.state.customSearch)

    const filterValueList = computed(() => {
      if (!data.value || !Array.isArray(data.value)) return []

      let filtered = []
     if(selectedFilter.value == 'individual'){
       filtered = data.value.map(agent => ({
            id: agent.id,
            name: agent.db_name
          }))

     
     }
     else if (selectedFilter.value === 'agent') {
        filtered = data.value
          .filter(agent => agent.agent_type == 0)
          .map(agent => ({
            id: agent.id,
            name: agent.db_name
          }))
      } 
      else if (selectedFilter.value === 'lms') {
        filtered = data.value
          .filter(agent => agent.agent_type == 1)
          .map(agent => ({
            id: agent.id,
            name: agent.db_name
          }))
      } 
      else if (selectedFilter.value === 'team') {
        filtered = data.value.map(agent => ({
          id: agent.team_id,
          name: agent.team_name
        }))
      } 
      else if (selectedFilter.value === 'market') {
        filtered = data.value.map(agent => ({
          id: agent.market_id,  // fixed typo: should use market_id
          name: agent.market_name
        }))
      } 
      else {
        return []
      }

      // ✅ remove duplicates
      const unique = Array.from(
        new Map(
          filtered.map(obj => [JSON.stringify(obj), obj])
        ).values()
      )

   
      return unique
    })


  watch(filterValueList, (newVal) => {
    customSeachStore.setFilterValueList(newVal)
  })

    customSeachStore.state.isResetting = false

   const reset = async() => {

      customSeachStore.state.isResetting = true
      const currentRoute = router.currentRoute.value;
      customSeachStore.state.customSearch = []
      selectedFilter.value  =  'individual' // = ref('all') // Default selected
      selectedFilterValue.value =  'all'  //ref('all') // Default "All"
      selectStartDate.value = ""
      selectEndDate.value = ""

      await router.replace({
        path: router.currentRoute.value.path,
        query: {}
      })

  
   }

   
    const searchType = route.params.search_type
    //Dynamic API URL 

    const dashboardOption = ref("")

    //if rustan is login  set  dashboardOption default value as team
    if( currentUser.agent_type == 2){
      if(!route.query.dashboardoption){
        dashboardOption.value = "team"
      }else{
       
        dashboardOption.value = route.query.dashboardoption
      }
    }else{
     
      if(!route.query.dashboardoption){
        dashboardOption.value = "individual"
      }else{
     
        dashboardOption.value = route.query.dashboardoption
        
      }
    }
  
  
    const leaderboardOption = ref('agent')

    const salesEmployementStatus = ref('Hired')


    const startYear = 2020;
    const currentYear = new Date().getFullYear();
    const years = Array.from(
      { length: currentYear - startYear + 1 },
      (_, i) => startYear + i
    );
    // const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);



    const pathWithoutMonthOption = ref([
      '/analytics/agents',
      '/analytics/market', 
      '/analytics/overall',
      '/admin/agent/manage_sales_agents', 
      '/admin/manage_standard_users',
      '/agent_performance/year',
      '/team_performance/year',
      '/feedback/feedback_by_sales',
      '/dashboard/dashboard_year_view',
      '/agent_performance/analytics',
      '/team_performance/analytics',
      '/admin/agent_performance/yearly',
      '/admin/upload_target_shipok_data',
       '/admin/upload_new_deposit_data',
       '/admin/upload_sales_evaluation_data',
       '/admin/markets_and_teams',

       '/admin/agent2/manage_sales_agents',
       '/overall_performance/year.vue',
      '/admin/overall_performance/yearly',
      '/admin/team_performance/yearly',
      '/overall_performance/year',
       '/admin/target/yearly',
       '/admin/target/custom_search/target'


    ])

    const pathWithoutYearOption = ref([
      '/admin/agent/manage_sales_agents',
      '/admin/manage_standard_users',
      '/feedback/feedback_by_sales',
      '/admin/upload_target_shipok_data',
      '/admin/upload_new_deposit_data' ,
      '/admin/upload_sales_evaluation_data' ,
       '/admin/markets_and_teams',
       
       '/admin/agent2/manage_sales_agents',
        '/admin/target/custom_search/target',

    ])

    const pathWithoutTrucksOption = ref([
      '/admin/agent/manage_sales_agents',
      '/admin/manage_standard_users',
      '/feedback/feedback_by_qa',
      '/feedback/feedback_by_sales',
      '/agent_performance/analytics',
      '/agent_performance/month',
      '/agent_performance/year',
       '/admin/upload_target_shipok_data',
      '/admin/upload_new_deposit_data',
      '/admin/upload_sales_evaluation_data',
      '/admin/sales_evaluation',
      '/',
       '/admin/markets_and_teams',
       '/team_performance/year',
       '/admin/agent2/manage_sales_agents',
       '/admin/team_performance/monthly',
       '/admin/team_performance/yearly',
        '/team_performance/month',
       '/team_performance/yearl',
       '/admin/overall_performance/yearly',
       '/admin/overall_performance/monthly',
        '/overall_performance/year',
        '/overall_performance/month',
        '/admin/target/monthly',
         '/admin/target/yearly',
        '/admin/target/custom_search/target'



    ])

    const pathWithCustomSearchOption = ref([
       '/admin/target/custom_search/target',

       
    ])


    const hasYearOption  = computed(() =>{
      if(!pathWithoutYearOption.value.includes(route.path)  ){
        return true
      }else{
        return false
      }
    })



    const hasMonthOption = computed(() =>{
      if(!pathWithoutMonthOption.value.includes(route.path)){
        return true
      }else{
        return false
      }
    })

     
    const hasTrucksOption = computed(() =>{
      if(!pathWithoutTrucksOption.value.includes(route.path) && !route.path.includes('/admin/agent') && !route.path.includes('/feedback')){
        return true
      }else{
        return false
      }
    })

    const hasCustomSearchOption = computed( () => pathWithCustomSearchOption.value.includes(route.path) )

    

    const dashboardListOfOptions  = computed(()  => {
      
      if (currentUser.agent_type == 2) {
        return [ 'team', 'overall']
      }else{
        return [ 'individual', 'team', 'overall']
      }
    })

    const search = () => {
      console.log("Searching for:", searchQuery.value);
    };

    const toggleTheme = () => {
      document.body.classList.toggle("dark-mode");
    };

    const toggleNotifications = () => {
      showNotifications.value = !showNotifications.value;
    };

    const toggleViewMode = () => {
      viewMode.value = viewMode.value === "card" ? "table" : "card";
    };

    const validateInputMonthAndYearDates = (month, year) => {
        const timestamp = Date.now()
        
        const date = new Date(timestamp)
          //  Extract year, month, and day
        const currentYear = date.getFullYear();
        const currentMonth = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed, so add 1
        const currentDay = date.getDate().toString().padStart(2, '0'); // Ensure two digits    
        
        //    current month and year timestamp
        const currentMonthYearTimestamp = new Date(`${currentYear}-${currentMonth}`).getTime()
        
        const givenMonthYearTimestamp = new Date(`${year}-${month}`).getTime() 

        if (givenMonthYearTimestamp > currentMonthYearTimestamp){
          return false
        }
        return true
      }

    const  validateInputYearDates = (year) => {
      const timestamp = Date.now()
        
        const date = new Date(timestamp)
          //  Extract year, month, and day
        const currentYear = date.getFullYear();
        const currentMonth = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed, so add 1
        const currentDay = date.getDate().toString().padStart(2, '0'); // Ensure two digits    
        
        //    current month and year timestamp
        const currentMonthYearTimestamp = new Date(`${currentYear}-${currentMonth}`).getTime()
        
        const givenMonthYearTimestamp = new Date(`${year}-${currentMonth}`).getTime() 

        if (givenMonthYearTimestamp > currentMonthYearTimestamp){
          return false
        }
        return true
    }

    const fetchSalesAgents = () => {
      if (route.path == '/admin/agent2/manage_sales_agents') {
         
          const currentRoute = router.currentRoute.value 

          router.push( {
             path: currentRoute.path,
             query: {
               employee_status: salesEmployementStatus.value
             } 

          })
      }
      return
    }
    const submitDateSelection = () => {

      if(route.path == '/dashboard'){
        
        const currentRoute = router.currentRoute.value;
        
        if (!['individual', 'team', 'overall'].includes(dashboardOption.value)  ) {
          alert("Dashboard option is invalid")
          return
        }

    
        router.push({
                path: currentRoute.path,
                query: {dashboardoption: dashboardOption.value },
        });        
      
        return
      }
      else if (route.path == '/analytics/agents' || 
          route.path == '/analytics/market' || 
          route.path == '/analytics/overall' || 
          route.path == '/agent_performance/year' || 
          route.path == '/team_performance/year' ||
          route.path == '/dashboard/dashboard_year_view' || 
          route.path == '/agent_performance/analytics' ||  
          route.path == '/team_performance/analytics' ||
          route.path == '/admin/agent_performance/yearly' ||
          route.path == '/admin/overall_performance/yearly' ||
          route.path == '/overall_performance/year' ||
          route.path == '/admin/team_performance/yearly' ||
          route.path ==  '/admin/target/yearly'
        
        ){
            if (!validateInputYearDates(selectedYear.value)){
            alert('Cannot Select Year greater than current Year')
            return
            }
            if (selectedYear.value) {
              const currentRoute = router.currentRoute.value;
              router.push({
                path: currentRoute.path,
                query: { ...currentRoute.query, year: selectedYear.value,  withTrucks:truckOption.value },
              });
              
            } else {
              alert("Please select a year.");
            }

      }else{
          if (!validateInputMonthAndYearDates(selectedMonth.value, selectedYear.value)){
            alert('Cannot Select Month and Year greater than current Month and Year')
            return
          }
          if (selectedMonth.value && selectedYear.value) {
            const currentRoute = router.currentRoute.value;
            if(route.path == '/'){
              router.push({
              path: currentRoute.path,
              query: { ...currentRoute.query, month: selectedMonth.value, year: selectedYear.value, withTrucks:truckOption.value, leaderboardOption: leaderboardOption.value },
            });
            }else {
              router.push({
                path: currentRoute.path,
                query: { ...currentRoute.query, month: selectedMonth.value, year: selectedYear.value, withTrucks:truckOption.value },
              });
            }
            console.log(`Redirecting to: ${currentRoute.path} with Month: ${selectedMonth.value}, Year: ${selectedYear.value}`);
          } else {
            alert("Please select both a month and a year.");
          }
      }

    };


   const submitCustomSearchSelection = () => {

      const { valid, message } = isValidMonthRange(selectStartDate.value, selectEndDate.value);

      if (!valid) {
        alert(message); // or show toast/snackbar
         return;
      }
     
      const currentRoute = router.currentRoute.value;   
       router.push({
              path: currentRoute.path,
              query: { ...currentRoute.query,start_date:selectStartDate.value,end_date:selectEndDate.value, filterBy: selectedFilter.value, filterId:selectedFilterValue.value  },})

    };


    // watch(filterValueList, (newVal, oldVal) => {
    //   customSeachStore.state.itemsPerPage = newVal.value.length
      
    
    // })



      //If Click I to other menu  selectedMonth and selectedYear will be empty
    watch(route, (newRoute, oldRoute)=> {
         urlPath.value = newRoute.fullPath
  
        
        if (Object.keys(newRoute.query).length == 0  ) {
          //  alert(JSON.stringify(newRoute.query))
            selectedMonth.value = ""
            selectedYear.value =  ""
            selectedFilterValue.value =  'all'  //ref('all') // Default "All"
            selectStartDate.value = ""
            selectEndDate.value = ""
            selectedFilter.value  =  'individual'
                  
            salesEmployementStatus.value = "Hired"
            if (currentUser.agent_type == 2){
                 dashboardOption.value = "team"
            }else{
                  dashboardOption.value = "individual"
            }
        
            leaderboardOption.value = "agent"
            
        }else{
          //  alert(JSON.stringify(newRoute.query))
            // selectedMonth.value = ""
            // selectedYear.value =  ""
            // salesEmployementStatus.value = "Hired"
        }
        console.log('navigation query is',newRoute.query)
      
    })

</script>

<style scoped>
  aside {
    transition: width 0.3s ease-in-out;
  }
  nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  nav ul li {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  nav ul li i {
    font-size: 1.2em;
  }
  header {
    z-index: 10;
  }
</style>
