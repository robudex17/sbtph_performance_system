<template>
  <div class="grid grid-cols-1 gap-4 p-4 mt-20">

    <div v-if="customSeachStore.state.loading">
      <spinner></spinner>
    </div>

    <div v-else>
      <div v-if=" data.length > 0">
        <p class="text-gray-800 font-bold text-3xl mb-2 text-center">
          {{ filterBy.toUpperCase() }} TARGET
        </p>
              

        <!-- Table filter: one or several names (agents, a team or a market) without a new search. The search above always loads the
             whole range, the Excel export follows what is chosen here. -->
        <div v-if="canFilter" class="mb-3 p-3 bg-white border rounded shadow-sm">
          <div class="flex flex-wrap items-center gap-3">
            <label class="text-sm font-medium text-gray-700">Search {{ filterLabel }}:</label>
            <input
              v-model="searchText"
              type="text"
              :placeholder="`Type a ${filterLabel}...`"
              class="border border-gray-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            <div class="relative">
              <button
                type="button"
                @click="pickerOpen = !pickerOpen"
                class="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white hover:bg-gray-50"
              >
                Pick {{ filterLabel }}s ({{ selectedIds.length }} selected) &#9662;
              </button>

              <div v-if="pickerOpen" class="absolute z-20 mt-1 w-72 bg-white border rounded shadow-lg">
                <div class="flex justify-between px-3 py-2 border-b text-xs">
                  <button type="button" class="text-blue-600 hover:underline" @click="selectShown">Select all shown</button>
                  <button type="button" class="text-red-600 hover:underline" @click="selectedIds = []">Clear</button>
                </div>
                <ul class="max-h-64 overflow-y-auto">
                  <li v-for="option in optionsShown" :key="option.id">
                    <label class="flex items-center gap-2 px-3 py-1 text-sm hover:bg-blue-50 cursor-pointer">
                      <input type="checkbox" :value="option.id" v-model="selectedIds" />
                      {{ option.name }}
                    </label>
                  </li>
                  <li v-if="optionsShown.length === 0" class="px-3 py-2 text-sm text-gray-500">No match</li>
                </ul>
                <div class="px-3 py-2 border-t text-right">
                  <button type="button" class="text-sm text-blue-600 hover:underline" @click="pickerOpen = false">Done</button>
                </div>
              </div>
            </div>

            <button v-if="isFiltered" type="button" @click="clearFilter" class="text-sm text-red-600 hover:underline">Clear filter</button>
            <span class="text-sm text-gray-600 ml-auto">Showing {{ filteredRows.length }} of {{ data.length }} rows</span>
          </div>

          <div v-if="selectedIds.length > 0" class="flex flex-wrap gap-2 mt-2">
            <span
              v-for="id in selectedIds"
              :key="id"
              class="inline-flex items-center gap-1 bg-blue-100 text-blue-800 rounded-full px-3 py-0.5 text-xs"
            >
              {{ nameById(id) }}
              <button type="button" class="font-bold hover:text-red-600" @click="removeSelected(id)">&times;</button>
            </span>
          </div>
        </div>

        <!-- Export Button OUTSIDE table -->
        <div class="w-full flex justify-end mb-2">
          <export-to-excel-component
            v-if="isAdmin && data?.length > 0 && filteredRows.length > 0"
            :exportUrl="exportUrl"
            :exportFileName="exportFileName"
            :query="exportQuery"
            :token="token"
           
            class=" !text-white !text-[10px] !px-2 !py-1 !rounded
                  !hover:bg-green-600 !transition-all !duration-200 shadow"
          />
        </div>
        <table class="w-full table-auto border-collapse bg-white">
          <thead>
            <tr class="bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 text-xs">
              <th class="cursor-pointer select-none hover:bg-blue-300 py-2 px-2 border text-center font-bold"  v-if="filterBy != 'team' && filterBy !='overall' " @click="toggleSort('id')">ID <span class="text-[10px]">{{ sortMark('id') }}</span></th>
              <th class="cursor-pointer select-none hover:bg-blue-300 py-2 px-2 border text-center font-bold"  v-if="filterBy != 'team' && filterBy !='overall'" @click="toggleSort('db_name')">Name <span class="text-[10px]">{{ sortMark('db_name') }}</span></th>
              <th class="py-2 px-2 border text-center font-bold"  v-if="filterBy != 'team' && filterBy !='overall'">Employee Status</th>
              <th class="cursor-pointer select-none hover:bg-blue-300 py-2 px-2 border text-center font-bold"  v-if="filterBy != 'team' " @click="toggleSort('market_name')">Market <span class="text-[10px]">{{ sortMark('market_name') }}</span></th>
              <th class="cursor-pointer select-none hover:bg-blue-300 py-2 px-2 border text-center font-bold" @click="toggleSort('team_name')">Team <span class="text-[10px]">{{ sortMark('team_name') }}</span></th>
              <th class="cursor-pointer select-none hover:bg-blue-300 py-2 px-2 border text-center font-bold" @click="toggleSort('period')">Month <span class="text-[10px]">{{ sortMark('period') }}</span></th>
              <th class="cursor-pointer select-none hover:bg-blue-300 py-2 px-2 border text-center font-bold" @click="toggleSort('period')">Year <span class="text-[10px]">{{ sortMark('period') }}</span></th>
              <th class="cursor-pointer select-none hover:bg-blue-300 py-2 px-2 border text-center font-bold"  @click="toggleSort('target')">Target <span class="text-[10px]">{{ sortMark('target') }}</span></th>
              <th class="cursor-pointer select-none hover:bg-blue-300 py-2 px-2 border text-center font-bold"  @click="toggleSort('shipok')">Shipok <span class="text-[10px]">{{ sortMark('shipok') }}</span></th>
              <th class="cursor-pointer select-none hover:bg-blue-300 py-2 px-2 border text-center font-bold"  @click="toggleSort('percentage')">Percentage(%) <span class="text-[10px]">{{ sortMark('percentage') }}</span></th>
              <th class="cursor-pointer select-none hover:bg-blue-300 py-2 px-1 border text-center font-bold" @click="toggleSort('remaining')">Remaining Units <span class="text-[10px]">{{ sortMark('remaining') }}</span></th>
              <th class="py-2 px-2 border text-center font-bold" v-if="filterBy == 'overall'">Target <span class="text-red-500">(No Truck)</span></th>
              <th class="py-2 px-2 border text-center font-bold" v-if="filterBy == 'overall'">Shipok <span class="text-red-500">(No Truck)</span></th>
              <th class="py-2 px-2 border text-center font-bold" v-if="filterBy == 'overall'">Percentage(%) <span class="text-red-500">(No Truck)</span></th>
              <th class="py-2 px-1 border text-center font-bold" v-if="filterBy == 'overall'">Remaining Units <span class="text-red-500">(No Truck)</span></th>
              <th class="py-2 px-2 border text-center font-bold" v-if="filterBy == 'team'">Team Mambers</th>
              <th class="py-2 px-2 border text-center font-bold" v-if="filterBy == 'overall'">Team</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="paginatedAgents.length === 0">
              <td colspan="12" class="py-6 text-center text-gray-500 font-medium">No row matches the filter.</td>
            </tr>
            <template v-for="agent in paginatedAgents" :key="rowKey(agent)">
              <!-- MAIN ROW -->
              <tr class="even:bg-blue-50 odd:bg-white">
                
                <td class="py-1 px-2 border text-center" v-if="filterBy != 'team' && filterBy != 'overall'">
                  {{ agent.id }}
                </td>

                <td class="py-1 px-2 border text-center" v-if="filterBy != 'team' && filterBy != 'overall'">
                  <div class="flex items-center space-x-2">
                    <img
                      v-if="agent.image_link"
                      :src="updateImageLink(agent.image_link)"
                      alt="Agent Image"
                      class="w-9 h-9 rounded-full object-cover shadow"
                    />
                    <span>{{ agent.db_name }}</span>
                  </div>
                </td>

                <td v-if="filterBy != 'team' && filterBy != 'overall'"
                  class="py-1 px-2 border text-center"
                  :class="{
                    'text-red-600 font-bold': agent.employee_status === 'Resigned',
                    'text-green-600 font-bold': agent.employee_status === 'Hired' || agent.employee_status === 'Rehired'
                  }"
                >
                  {{ agent.employee_status }}
                </td>

                <td class="py-1 px-2 border text-center" v-if="filterBy != 'team'">
                  {{ agent.market_name?.toUpperCase?.() ?? '' }}
                </td>

                <td class="py-1 px-2 border text-center">{{ agent.team_name }}</td>
                <td class="py-1 px-2 border text-center">{{ agent.month }}</td>
                <td class="py-1 px-2 border text-center">{{ agent.year }}</td>
                <td class="py-1 px-2 border text-center font-bold">{{ agent.target }}</td>
                <td class="py-1 px-2 border text-center font-bold">{{ agent.shipok }}</td>

                <td class="py-1 px-2 border text-center font-bold">
                  {{ getWholeNumberPercentage(agent.target, agent.shipok) }}
                </td>

                <td
                  class="py-1 px-2 border text-center font-bold"
                  :class="(agent.target - agent.shipok) >= 0 ? 'text-red-600 border' : 'text-green-600'"
                >
                  {{ agent.target - agent.shipok }}
                </td>

                <td class="py-1 px-2 border text-center font-bold" v-if="filterBy == 'overall'">{{ agent.target_without_trucks }}</td>
                <td class="py-1 px-2 border text-center font-bold" v-if="filterBy == 'overall'">{{ agent.shipok_without_trucks }}</td>

                <td class="py-1 px-2 border text-center font-bold" v-if="filterBy == 'overall'">
                  {{ getWholeNumberPercentage(agent.target_without_trucks, agent.shipok_without_trucks) }}
                </td>

                <td
                  class="py-1 px-2 border text-center font-bold" v-if="filterBy == 'overall'"
                  :class="(agent.target_without_trucks - agent.shipok_without_trucks) >= 0 ? 'text-red-600 border' : 'text-green-600'"
                >
                  {{ agent.target_without_trucks - agent.shipok_without_trucks }}
                </td>                

                <!-- BUTTON -->
                <td v-if="filterBy == 'team' || filterBy == 'overall'" class="py-1 px-2 border text-center font-bold">
                  <button 
                    class="px-3 py-0 text-white rounded transition"
                    :class="uniqueKey(agent) === openRowId ? 'bg-orange-500' : 'bg-blue-500'"
                    @click="toggle(uniqueKey(agent))"
                  >
                    {{ uniqueKey(agent) === openRowId ? 'Hide Breakdown' : 'Show Breakdown' }}
                  </button>
                </td>
              </tr>

              <!-- BREAKDOWN ROW -->
              <tr v-if="uniqueKey(agent) === openRowId">
              <td :colspan=" filterBy === 'team'  ? 11   : filterBy === 'overall'  ? 7  : 12 " class="border p-0">

                  <Transition name="slide">
                    <div v-if="uniqueKey(agent) === openRowId" class="breakdown-wrapper">
                      <table class="table-auto border w-full bg-gray-50">
                        <thead>
                            <tr class="bg-red-400 text-white text-xs py-1">
                              <th class=" px-2 border text-center font-bold text-xs text-white" v-if="filterBy === 'team'">ID</th>
                              <th class=" px-2 border text-center font-bold text-xs" v-if="filterBy === 'team'" >Name</th>
                              <th class=" px-2 border text-center font-bold text-xs" v-if="filterBy === 'team'">Employee Status</th>
                              <th class=" px-2 border text-center font-bold text-xs" v-if="filterBy === 'team'" >Market</th>
                              <th class=" px-2 border text-center font-bold text-xs">Team</th>
                              <th class=" px-2 border text-center font-bold text-xs">Month</th>
                              <th class=" px-2 border text-center font-bold text-xs">Year</th>
                              <th class=" px-2 border text-center font-bold text-xs">Target</th>
                              <th class=" px-2 border text-center font-bold text-xs">Shipok</th>
                              <th class=" px-2 border text-center font-bold text-xs">Percentage(%)</th>
                            
                              <th class=" px-1 border text-center font-bold">
                                <div class="flex items-center justify-center gap-2">
                                  <span>Remaining Units</span>
                                </div>
                              </th>
                        
                            </tr>
                        </thead>
                        <tbody>


                        <tr v-for="member in agent.teammembers" :key="member.id" class="even:bg-red-50 odd:bg-white ext-white text-xs py-1"  >
                          
                          <td class="py-1 px-2 border text-center" v-if="filterBy === 'team'">
                            {{ member.id }}
                          </td>

                          <td class="py-1 px-2 border text-center" v-if="filterBy === 'team'">
                            <div class="flex items-center space-x-2">
                              <img
                                v-if="member.image_link"
                                :src="updateImageLink(member.image_link)"
                                alt="Agent Image"
                                class="w-9 h-9 rounded-full object-cover shadow"
                              />
                              <span>{{ member.db_name }}</span>
                            </div>
                          </td>

                          <td v-if="filterBy === 'team'"
                            class="py-1 px-2 border text-center"
                            :class="{
                              'text-red-600 font-bold': member.employee_status === 'Resigned',
                              'text-green-600 font-bold': member.employee_status === 'Hired' || member.employee_status === 'Rehired'
                            }"
                          >
                            {{ member.employee_status }}
                          </td>

                          <td class="py-1 px-2 border text-center"  v-if="filterBy === 'team'">
                            {{ member.market_name?.toUpperCase?.() ?? '' }}
                          </td>

                          <td class="py-1 px-2 border text-center">{{ member.team_name }}</td>
                          <td class="py-1 px-2 border text-center">{{ member.month }}</td>
                          <td class="py-1 px-2 border text-center">{{ member.year }}</td>
                          <td class="py-1 px-2 border text-center font-bold">{{ member.target }}</td>
                          <td class="py-1 px-2 border text-center font-bold">{{ member.shipok }}</td>

                          <td class="py-1 px-2 border text-center font-bold">
                            {{ getWholeNumberPercentage(member.target, member.shipok) }}
                          </td>

                          <td
                            class="py-1 px-2 border text-center font-bold"
                            :class="(member.target - member.shipok) >= 0 ? 'text-red-600 border' : 'text-green-600'"
                          >
                            {{ member.target - member.shipok }}
                          </td>

                 
                        </tr>

                        </tbody>
                      </table>
                    </div>
                  </Transition>

                </td>
              </tr>
            </template>
          </tbody>


        </table>


        <!-- ✅ Pagination -->
        <div
          v-if="totalPages > 1"
          class="mt-4 flex justify-center space-x-4 mb-2"
        >
          <button
            v-for="page in totalPages"
            :key="page"
            class="px-4 py-2 border rounded"
            :class="{
              'bg-blue-500 text-white': currentPage === page,
              'bg-white text-gray-700': currentPage !== page,
            }"
            @click="currentPage = page"
          >
            {{ page }}
          </button>
        </div>
      </div>

      <div v-else class="text-red-700 font-bold text-5xl text-center">
        No Available Data.
      </div>
    </div>
  </div>
</template>

<script setup>
    definePageMeta({
      middleware: ['auth']
    })

    import { ref, computed, onMounted, watch } from 'vue'
    import { useRouter, useRoute } from 'vue-router'
    import API from '~/utils/api'

    import { months, getWholeNumberPercentage } from '@/utils/constants'
   
    const authStore = useAuthStore()
    authStore.fetchTokenFromLocalStore()

    const router = useRouter()
    const route = useRoute()
    const currentUser = authStore.state.user
    const token = authStore.state.token
    
    const isAdmin = ref(false)
    const query = ref('')
    const filterBy = ref('')
    const filterId = ref('')
    const openRowId = ref(null)

  
    filterBy.value = route.query.filterBy 
    filterId.value = route.query.filterId
    query.value = route.query

    const exportUrl = API.export.custom_search_target_export
    const searchType = route.params.search_type


    // month.value = route.query.month || months[new Date().getMonth()]
    // year.value = route.query.year || new Date().getFullYear()

    // Store
    const customSeachStore = useCustomSearchStore()
    const data = computed(() => customSeachStore.state.customSearch)

    // ✅ Pagination
    const itemsPerPage = ref(100)   // 100 rows per page, like the dashboard (GOM request)
    const currentPage = ref(1)

    // ✅ Table filter: one or several names (agents, a team or a market), no new search. The server sends the whole range once,
    // the rows are filtered here and the Excel export gets the same choice (filterIds).
    const canFilter = computed(() => (isAdmin.value || currentUser.agent_type == 2 || Number(currentUser.position_level) === 15) && filterBy.value !== 'overall')
    const searchText = ref('')
    const selectedIds = ref([])
    const pickerOpen = ref(false)

    // the id and the name of a row: the agent (individual, agent, lms), the market or the team
    const fieldsOf = () =>
      filterBy.value === 'team' ? ['team_id', 'team_name'] : filterBy.value === 'market' ? ['market_id', 'market_name'] : ['id', 'db_name']
    const filterLabel = computed(() => filterBy.value === 'team' ? 'team' : filterBy.value === 'market' ? 'market' : 'name')

    const filterOptions = computed(() => {
      if (!canFilter.value || !Array.isArray(data.value)) return []
      const [idField, nameField] = fieldsOf()
      const unique = new Map()
      data.value.forEach(row => {
        const id = String(row[idField])
        if (!unique.has(id)) unique.set(id, { id, name: String(row[nameField] ?? '') })
      })
      return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name))
    })

    // the options that match the text typed in the search box
    const optionsShown = computed(() => {
      const text = searchText.value.trim().toLowerCase()
      return text === '' ? filterOptions.value : filterOptions.value.filter(option => option.name.toLowerCase().includes(text))
    })

    const filteredRows = computed(() => {
      const rows = data.value || []
      if (!canFilter.value) return rows
      const [idField, nameField] = fieldsOf()
      const text = searchText.value.trim().toLowerCase()
      return rows.filter(row =>
        (selectedIds.value.length === 0 || selectedIds.value.includes(String(row[idField]))) &&
        (text === '' || String(row[nameField] ?? '').toLowerCase().includes(text))
      )
    })

    const isFiltered = computed(() => canFilter.value && (selectedIds.value.length > 0 || searchText.value.trim() !== ''))
    const nameById = (id) => filterOptions.value.find(option => option.id === id)?.name ?? id
    const removeSelected = (id) => { selectedIds.value = selectedIds.value.filter(selected => selected !== id) }
    const selectShown = () => { selectedIds.value = [...new Set([...selectedIds.value, ...optionsShown.value.map(option => option.id)])] }
    const clearFilter = () => { selectedIds.value = []; searchText.value = '' }

    // the Excel export has the rows of the table: the ids of the rows shown go with the request (nothing chosen = the whole range)
    const exportQuery = computed(() => {
      if (!isFiltered.value) return query.value
      const [idField] = fieldsOf()
      const ids = [...new Set(filteredRows.value.map(row => String(row[idField])))]
      return { ...query.value, filterIds: ids.join(',') }
    })

    // ✅ Sort by a column (click: ascending, again: descending, again: the original order)
    const sortValueOf = {
      id: (row) => Number(row.id) || 0,
      db_name: (row) => String(row.db_name ?? '').toLowerCase(),
      market_name: (row) => String(row.market_name ?? '').toLowerCase(),
      team_name: (row) => String(row.team_name ?? '').toLowerCase(),
      // Month and Year sort by the period: the year first, then the month
      period: (row) => Number(row.year) * 12 + Math.max(months.indexOf(row.month), 0),
      target: (row) => Number(row.target) || 0,
      shipok: (row) => Number(row.shipok) || 0,
      // the same whole number the table shows
      percentage: (row) => parseInt(getWholeNumberPercentage(row.target, row.shipok)),
      remaining: (row) => (Number(row.target) || 0) - (Number(row.shipok) || 0),
    }
    const { sortKey, sortDirection, toggleSort, sortMark, sortedRows } = useColumnSort(filteredRows, sortValueOf)

    const totalPages = computed(() =>
      Math.ceil(sortedRows.value.length / itemsPerPage.value)
    )

    const paginatedAgents = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value
      const end = start + itemsPerPage.value
      return sortedRows.value?.slice(start, end)
    })

    if (currentUser.role == 'poweruser' || currentUser.role == 'admin' ) {
         isAdmin.value = true
    }

    const exportFileName = computed(() => {

      if(route.query.start_date && route.query.end_date){
            const [ start_year, start_month] = route.query.start_date.split("-")
            const [ end_year,  end_month ] = route.query.end_date.split("-")
        
        return `${months[Number(start_month) -1]}${start_year}-${months[Number(end_month)-1]}${end_year}-target.xlsx`
      }
      
        return `NoFilename-target.xlsx`
       

    })

    //Unique combo for each row

    const uniqueKey = (team) => `${team?.team_id}-${team?.month}-${team?.year}`

    // The key of a row of the table. In the individual view many agents share the team, the month and the year, so the agent id is part
    // of it (the same key twice makes the rows stale or doubled when the filter or the sort changes the list).
    const rowKey = (row) => `${row?.id ?? 'group'}-${row?.team_id}-${row?.month}-${row?.year}`

    const toggle = (rowId) => {
         openRowId.value = openRowId.value === rowId ? null : rowId
    }


    // ✅ Fetch function (clears old data properly)
    const fetchCustomSearchData = async (searchType, query) => {
      customSeachStore.state.customSearch = [] // clear before fetch
      customSeachStore.state.loading = true
      await customSeachStore.fetchCustomSearch(searchType, query)
      customSeachStore.state.loading = false
      currentPage.value = 1 // reset pagination
    }

    // ✅ Config for image URL
    const config = useRuntimeConfig()
    const updateImageLink = (imageLink) => {
      return `${config.public.imageBaseUrl}${imageLink}`
    }

    // ✅ Initial fetch
    onMounted(() => {
      // fetchCustomSearchData(searchType, route.query)
       customSeachStore.state.customSearch = []
      
    })



    // ✅ Watch route change only when query changes
    watch(
      () => route.fullPath,
      (newRoute, oldRoute) => {
        if (newRoute !== oldRoute) {
          
          fetchCustomSearchData(searchType, route.query)
           query.value = route.query
           filterBy.value = route.query.filterBy 
           filterId.value = route.query.filterId
        }
      }
    )




    // ✅ Reset page when data changes
    // a new search: back to page 1 and the filter starts empty again
    watch(data, () => {
      currentPage.value = 1
      clearFilter()
    })

    // the filter or the sort changed: back to page 1
    watch([selectedIds, searchText, sortKey, sortDirection], () => {
      currentPage.value = 1
    }, { deep: true })


</script>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s ease;
  }
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }

  /* ⭐ Slide Down Animation */
  .slide-enter-active,
  .slide-leave-active {
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .slide-enter-from,
  .slide-leave-to {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
  }

  .slide-enter-to,
  .slide-leave-from {
    opacity: 1;
    max-height: 500px; /* big enough to fit the table */
    transform: translateY(0);
  }

  /* Wrapper to ensure height animation works */
  .breakdown-wrapper {
    padding: 0.5rem;
  }
</style>
