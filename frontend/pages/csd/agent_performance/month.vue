<template>
  <div>
    <div class="p-4 mt-20">
      <div v-if="store.state.loading">
        <spinner></spinner>
      </div>

      <div v-else>
        <!-- Toggle Button for Card/Table View. Admin and poweruser: the table and the Excel -->
        <div class="mb-4 flex justify-end">
          <button
            v-if="!isAdmin"
            @click="isCardView = !isCardView"
            class="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-300"
          >
            <font-awesome-icon :icon="['fas', isCardView ? 'toggle-off' : 'toggle-on']" />
            Toggle to {{ isCardView ? 'Table' : 'Card' }} View
          </button>
          <export-to-excel-component
            v-if="isAdmin && agent"
            class="ml-2"
            :exportUrl="exportUrl"
            :exportFileName="exportFileName"
            :query="{ year_month: yearMonth, department: departmentCode }"
            :token="token"
            :submitted="1"
            :submittedArray="false"
            :incomplete="false"
          ></export-to-excel-component>
        </div>

        <div class="text-red-700 font-bold text-5xl" v-if="store.state.error">{{ store.state.error }}</div>
        <div v-else-if="!agent" class="text-red-700 font-bold text-5xl">
          No Available Data.
        </div>
        <div v-else>
          <!-- CARD VIEW -->
          <div v-if="isCardView" class="grid grid-cols-1 gap-6">
            <EvaluationPerformanceCard :agent="agent" @details="showDetails"></EvaluationPerformanceCard>
          </div>

          <!-- TABLE VIEW -->
          <div v-else class="overflow-x-auto shadow-xl rounded-lg">
            <h1 class="text-2xl font-bold mb-2 text-center">
              {{ agent.month }} {{ agent.year }} Monthly Performance:
              <span :class="csdRatingClass(agent.ratings_name) || setRatingNameColor(agent)">{{ agent.final_ratings }}</span> /
              <span :class="csdRatingClass(agent.ratings_name) || setRatingNameColor(agent)">{{ agent.ratings_name }}</span>
            </h1>
            <leader-board-table :agents="[agent]"></leader-board-table>
            <evaluation-metrics-summary :agents="[agent]"></evaluation-metrics-summary>
          </div>
        </div>
      </div>
    </div>

    <EvaluationPerformanceDetailsModal :show="showModal" :agent="selectedAgent" @close="showModal = false"></EvaluationPerformanceDetailsModal>
  </div>
</template>

<script setup>
// CSD Agent Monthly (one employee, one month): the card / table view and the details of the employee.
// The employee comes from ?employee_id (the list page links to it). A staff member of position level 1, 2, 3 sees only
// his/her own performance: the backend answers only with the rows the user may see, this page only follows it.
import { ref, reactive, computed, onMounted, watch } from 'vue'
import API from '~/utils/api'
import LeaderBoardTable from '~/components/evaluation/LeaderBoardTable.vue'

definePageMeta({
  middleware: ['auth', 'department-layout'],
  layout: 'csd',
  // Collection uses this page too (the layout and the staff follow the url)
  alias: ['/collection/agent_performance/month', '/purchasing/agent_performance/month', '/hr/agent_performance/month'],
})

const authStore = useAuthStore()
authStore.fetchTokenFromLocalStore()
const currentUser = authStore.state.user
const token = authStore.state.token

const route = useRoute()
// csd or collection (from the url): the backend answers with the staff of that department
const { code: departmentCode, base } = useDepartmentView()
const store = useEvaluationAgentPerformanceStore()
const { setRatingNameColor } = useRatingColor()

const isAdmin = ['admin', 'poweruser'].includes(currentUser?.role)
const isCardView = ref(!isAdmin)

const today = new Date()
const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
const yearMonth = computed(() => route.query.year_month || currentYearMonth)

// the logged in employee when no employee is chosen
const employeeId = computed(() => route.query.employee_id || currentUser?.login_id)

const agent = computed(() => store.state.monthly[0] ?? null)

const exportUrl = computed(() => `${API.evaluation_agent_performance_export}/monthly/${employeeId.value}`)
const exportFileName = computed(() => `${departmentCode.value}-${agent.value?.db_name}-monthly-performance-${yearMonth.value}.xlsx`)

const selectedAgent = reactive({})
const showModal = ref(false)
const showDetails = (row) => {
  Object.assign(selectedAgent, row)
  showModal.value = true
}

const load = () => store.fetchPerformance('monthly', employeeId.value, { year_month: yearMonth.value, department: departmentCode.value })

onMounted(load)
watch(() => [route.query.year_month, route.query.employee_id], load)
</script>
