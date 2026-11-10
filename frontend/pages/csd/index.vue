<template>
  <div>
  <div class="p-4 mt-20">

    <div v-if="csdStoreInstance.state.loading">
      <spinner></spinner>
    </div>

    <!-- Leaderboard View -->
    <div v-else>

      <!-- Toggle Button for Card/Table View (agent and team leader boards only, the team board is cards) -->
      <div v-if="canViewTable && leaderboardOption != 'team' && csd_leaderboard.length > 0" class="mb-4 flex justify-end">
        <button
          @click="toggleView"
          class="bg-blue-600 text-white py-1 px-2 rounded-lg hover:bg-blue-700 transition duration-300"
        >
          <font-awesome-icon :icon="['fas', isCardView ? 'toggle-off' : 'toggle-on']" />
          Toggle to {{ isCardView ? 'Table' : 'Card' }} View
        </button>
        <export-to-excel-component
          v-if="isExporter && !isCardView"
          class="ml-2"
          :exportUrl="exportUrl"
          :exportFileName="exportFileName"
          :query="{ ...route.query, department: departmentCode }"
          :token="token"
          :incomplete="false"
        ></export-to-excel-component>
      </div>

      <div class="text-red-700 font-bold text-5xl" v-if="csdStoreInstance.state.error">{{ csdStoreInstance.state.error }}</div>
      <div v-else-if="csd_leaderboard.length === 0" class="text-red-700 font-bold text-5xl">
        No Available Data.
      </div>
      <div v-else>

        <!-- some evaluations are not submitted yet: their rating is not counted -->
        <p v-if="incomplete" class="mb-4 text-yellow-600 font-semibold">
          Some of the evaluations are not submitted yet, they are shown as INCOMPLETE RATING.
        </p>

        <!-- CARD VIEW: TEAM -->
        <div v-if="leaderboardOption == 'team'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div
            v-for="team in csd_leaderboard"
            :key="team.team_id"
            class="bg-gray-800 text-white border rounded-lg shadow-lg overflow-hidden"
          >
            <div class="flex flex-col items-center justify-center text-center p-4">
              <div
                class="px-3 py-1 m-2 text-xl font-semibold"
                :class="team.tag ? 'px-4 py-1 text-sm font-bold uppercase tracking-widest bg-purple-600/20 text-purple-400 rounded-full border border-purple-500' : 'py-5'"
              >
                {{ team.tag }}
              </div>

              <img
                v-if="team.team_image"
                :src="updateImageLink(team.team_image)"
                alt="Team Image"
                class="w-20 h-20 rounded-full object-cover mb-4"
              />
              <div v-else class="w-20 h-20 bg-gray-300 rounded-full mb-4 flex items-center justify-center text-white">
                <span class="text-lg pb-2">{{ team.team_name || '' }}</span>
              </div>

              <div class="text-center flex flex-col items-center">
                <h2 class="text-lg font-semibold">{{ team.team_name }}</h2>
                <p class="text-sm text-gray-400">Team Leader: {{ team.team_leader_name }}</p>
                <p class="text-sm font-bold p-2" :class="descriptionColor(team.ratings_name) || setRatingNameColor(team)">{{ team.ratings_name }}</p>

                <div class="flex items-center justify-center mt-1">
                  <template v-for="i in 5" :key="i">
                    <svg xmlns="http://www.w3.org/2000/svg" :class="getStarClass(team.final_ratings, i)" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                  </template>
                </div>

                <p class="text-xl font-bold mt-2">{{ team.final_ratings }}</p>
                <p class="text-xl font-bold mt-2">{{ team.month }}</p>
                <p class="text-xl font-bold mt-2">{{ team.year }}</p>
              </div>

              <button
                @click="showTeamDetails(team)"
                class="mt-3 text-green-300 hover:text-green-500 font-semibold hover:underline hover:scale-105 transition duration-300"
              >
                Performance Details
              </button>
            </div>
          </div>
        </div>

        <!-- TABLE VIEW: AGENT and TEAM LEADER -->
        <div v-else-if="!isCardView" class="overflow-x-auto shadow-xl rounded-lg">
          <leader-board-table :agents="csd_leaderboard"></leader-board-table>
        </div>

        <!-- CARD VIEW: AGENT and TEAM LEADER -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div
            v-for="agent in csd_leaderboard"
            :key="agent.id"
            class="bg-gray-800 text-white border rounded-lg shadow-lg overflow-hidden"
          >
            <div class="flex flex-col items-center p-4">
              <div
                class="px-3 py-1 m-2 text-xl font-semibold"
                :class="agent.tag ? 'px-4 py-1 text-sm font-bold uppercase tracking-widest bg-purple-600/20 text-purple-400 rounded-full border border-purple-500' : 'py-5'"
              >
                {{ agent.tag }}
              </div>
              <img
                v-if="agent.image_link"
                :src="updateImageLink(agent.image_link)"
                alt="Agent Image"
                class="w-20 h-20 rounded-full object-cover mb-4"
              />
              <div v-else class="w-20 h-20 bg-gray-300 rounded-full mb-4 flex items-center justify-center text-white">
                <span class="text-xl">{{ agent.db_name }}</span>
              </div>
              <div class="text-center">
                <h3 class="text-lg font-semibold">{{ agent.db_name }}</h3>
                <p class="text-sm font-bold" :class="descriptionColor(agent.ratings_name) || setRatingNameColor(agent)">{{ agent.ratings_name }}</p>

                <div class="flex items-center mt-2">
                  <template v-for="i in 5" :key="i">
                    <svg xmlns="http://www.w3.org/2000/svg" :class="getStarClass(agent.final_ratings, i)" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                  </template>
                </div>

                <p class="text-xl font-bold mt-2">{{ agent.final_ratings }}</p>
                <p class="text-xl font-bold mt-2">{{ agent.month }}</p>
                <p class="text-xl font-bold mt-2">{{ agent.year }}</p>
              </div>
              <!-- the details are sent by the backend only to who can see them (admin, managers, the team leader of the team, the employee) -->
              <button
                v-if="agent.can_view_details"
                @click="showAgentDetails(agent)"
                class="text-green-300 hover:text-green-500 font-semibold hover:underline hover:scale-105 transition duration-300"
              >
                Performance Details
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Modal for Employee Details -->
  <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div class="bg-gray-800 text-white p-6 rounded-lg w-full md:w-2/3 lg:w-1/2 h-auto overflow-auto">
      <div class="flex flex-col items-center">

        <img
          v-if="selectedAgent.image_link"
          :src="updateImageLink(selectedAgent.image_link)"
          alt="Agent Image"
          class="w-40 h-40 rounded-full object-cover mb-4"
        />
        <div v-else class="w-40 h-40 bg-gray-300 rounded-full mb-4 flex items-center justify-center text-white">
          <span class="text-4xl">{{ selectedAgent.db_name }}</span>
        </div>

        <div class="text-center">
          <h3 class="text-3xl font-semibold">{{ selectedAgent.db_name }}</h3>
          <h3 class="text-xl font-semibold">EmployeeID: {{ selectedAgent.id }}</h3>
          <p class="text-lg font-bold" :class="descriptionColor(selectedAgent.ratings_name) || setRatingNameColor(selectedAgent)">{{ selectedAgent.ratings_name }}</p>

          <div class="flex items-center justify-center mt-2">
            <template v-for="i in 5" :key="i">
              <svg xmlns="http://www.w3.org/2000/svg" :class="getStarClass(selectedAgent.final_ratings, i)" width="35" height="30" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
            </template>
          </div>

          <p class="text-3xl font-bold mt-2">{{ selectedAgent.final_ratings }}</p>
        </div>
        <p class="text-lg font-bold mt-2">Month Of: {{ selectedAgent.month }}</p>
        <p class="text-lg font-bold mt-2">Year: {{ selectedAgent.year }}</p>

        <div class="mt-6 w-full overflow-x-auto">
          <table class="min-w-full table-auto">
            <thead>
              <tr>
                <th class="px-4 py-2 border bg-gray-800 text-white">Employee Status</th>
                <th class="px-4 py-2 border bg-gray-800 text-white">Position</th>
                <th class="px-4 py-2 border bg-gray-800 text-white">Team</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="px-4 py-2 font-semibold border text-center bg-gray-900">
                  <span :class="selectedAgent.employee_status === 'Resigned' ? 'text-red-500 font-bold' : 'text-green-500 font-bold'">{{ selectedAgent.employee_status }}</span>
                </td>
                <td class="px-4 py-2 font-semibold border bg-gray-900 text-gray-100 text-center">{{ selectedAgent.position_name }}</td>
                <td class="px-4 py-2 font-semibold border bg-gray-900 text-gray-100 text-center">{{ (selectedAgent.team_name || '').toUpperCase() }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- How the rating is made: result -> score -> weight -> rating -->
        <div class="mt-6 w-full overflow-x-auto">
          <table class="min-w-full table-auto">
            <thead>
              <tr>
                <th class="px-4 py-2 border bg-gray-800 text-white">Metric</th>
                <th class="px-4 py-2 border bg-gray-800 text-white">Result</th>
                <th class="px-4 py-2 border bg-gray-800 text-white">Score</th>
                <th class="px-4 py-2 border bg-gray-800 text-white">Rating</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="metric in selectedAgentMetrics" :key="metric.name">
                <td class="px-4 py-2 font-semibold border bg-gray-900 text-gray-100">{{ metric.name }}</td>
                <!-- not submitted yet: the value is not counted, NO DATA in bold red -->
                <template v-if="metric.noData">
                  <td v-for="column in 3" :key="column" class="px-4 py-2 border bg-gray-900 text-center font-bold text-red-500">NO DATA</td>
                </template>
                <template v-else>
                  <td class="px-4 py-2 font-semibold border bg-gray-900 text-gray-100 text-center">
                    {{ metric.result }}
                    <span v-if="metric.description" class="block" :class="descriptionColor(metric.description)">{{ metric.description }}</span>
                  </td>
                  <td class="px-4 py-2 font-semibold border bg-gray-900 text-gray-100 text-center">
                    {{ metric.score }}
                    <span v-if="metric.scoreDescription" class="block" :class="descriptionColor(metric.scoreDescription)">{{ metric.scoreDescription }}</span>
                  </td>
                  <td class="px-4 py-2 font-semibold border bg-gray-900 text-gray-100 text-center">{{ metric.rating }}</td>
                </template>
              </tr>
              <tr>
                <td class="px-4 py-2 font-bold border bg-gray-700 text-white" colspan="3">Final Rating</td>
                <td class="px-4 py-2 font-bold border bg-gray-700 text-white text-center">{{ selectedAgent.final_ratings }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          @click="closeModal"
          class="mt-6 text-blue-300 hover:text-blue-500 font-semibold hover:underline hover:scale-105 transition duration-300"
        >
          Close
        </button>
      </div>
    </div>
  </div>

  <!-- Modal for Team Details -->
  <div v-if="showModalForTeam" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div class="bg-gray-800 text-white p-8 rounded-2xl w-full md:w-2/3 lg:w-1/2 xl:w-1/3 max-h-[90vh] overflow-y-auto shadow-2xl">
      <div class="flex flex-col items-center text-center">
        <img
          v-if="selectedTeam.team_image"
          :src="updateImageLink(selectedTeam.team_image)"
          alt="Team Image"
          class="w-40 h-40 rounded-full object-cover mb-4 border-4 border-gray-700 shadow-md"
        />
        <div v-else class="w-40 h-40 bg-gray-600 rounded-full mb-4 flex items-center justify-center text-white shadow-md">
          <span class="text-4xl font-bold">{{ selectedTeam.team_name }}</span>
        </div>

        <div class="flex flex-col items-center">
          <h3 class="text-3xl font-semibold mb-2">{{ selectedTeam.team_name }}</h3>
          <p class="text-sm text-gray-400">Team Leader: {{ selectedTeam.team_leader_name }}</p>
          <p class="text-lg font-bold mb-2" :class="descriptionColor(selectedTeam.ratings_name) || setRatingNameColor(selectedTeam)">{{ selectedTeam.ratings_name }}</p>

          <div class="flex items-center justify-center mt-2 mb-3">
            <template v-for="i in 5" :key="i">
              <svg xmlns="http://www.w3.org/2000/svg" :class="getStarClass(selectedTeam.final_ratings, i)" width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
            </template>
          </div>

          <p class="text-3xl font-bold mt-1">{{ selectedTeam.final_ratings }}</p>
          <p class="text-lg font-semibold mt-3">Month Of: <span class="font-normal">{{ selectedTeam.month }}</span></p>
          <p class="text-lg font-semibold">Year: <span class="font-normal">{{ selectedTeam.year }}</span></p>
        </div>

        <div class="mt-6 w-full overflow-x-auto">
          <table class="min-w-full table-auto border-collapse border border-gray-700 text-center">
            <thead>
              <tr class="bg-gray-700">
                <th class="px-4 py-2 border border-gray-600">Team Members</th>
                <th class="px-4 py-2 border border-gray-600">Position</th>
                <th class="px-4 py-2 border border-gray-600">Rating</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in selectedTeam.teams" :key="member.id" class="bg-gray-900 hover:bg-gray-700 transition">
                <td class="border border-gray-700 px-2 py-2">
                  <div class="flex items-center space-x-2">
                    <img
                      v-if="member.image_link"
                      :src="updateImageLink(member.image_link)"
                      alt="Agent Image"
                      class="w-10 h-10 rounded-full object-cover border border-gray-600"
                    />
                    <span class="font-medium">{{ member.db_name }}</span>
                    <span v-if="member.position_level == 8" class="text-blue-400 font-bold">- TL</span>
                  </div>
                </td>
                <td class="px-4 py-2 border border-gray-700 font-semibold">{{ member.position_name }}</td>
                <td class="px-4 py-2 border border-gray-700 font-semibold" :class="setRatingNameColor(member)">
                  {{ member.final_ratings }}
                  <span v-if="member.submitted != 1" class="block text-xs">INCOMPLETE</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          @click="closeModalForTeam"
          class="mt-6 text-blue-300 hover:text-blue-500 font-semibold hover:underline hover:scale-105 transition duration-300"
        >
          Close
        </button>
      </div>
    </div>
  </div>

  </div>
</template>

<script setup>

import { onMounted, reactive, ref, watch, computed } from 'vue';
import { getStarClass } from '@/utils/constants'
import API from '~/utils/api'
import LeaderBoardTable from '~/components/evaluation/LeaderBoardTable.vue'

definePageMeta({
  middleware: ['auth', 'department-layout'],
  layout: 'csd',
  // the leaderboard of Collection is this page too (the layout and the staff follow the url)
  alias: ['/collection', '/purchasing', '/hr'],
})

const route = useRoute()
// csd or collection (from the url): the backend answers with the staff of that department
const { code: departmentCode } = useDepartmentView()
const config = useRuntimeConfig()
const csdStoreInstance = useEvaluationStore()
const { setRatingNameColor } = useRatingColor()

// the table view and the Excel export need the details of everybody: admin, poweruser and the CSD managers (level 10 and 9)
const authStore = useAuthStore()
authStore.fetchTokenFromLocalStore()
const currentUser = authStore.state.user
const token = authStore.state.token
const isExporter = ['admin', 'poweruser'].includes(currentUser?.role)
const canViewTable = isExporter || [10, 9].includes(Number(currentUser?.position_level))

const isCardView = ref(true)

const selectedAgent = reactive({});
const selectedTeam = reactive({});
const showModal = ref(false);
const showModalForTeam = ref(false)

// agent, team_leader or team (the select of the navigation bar sets it in the query)
const leaderboardOption = ref(route.query.scope || 'agent')

const toggleView = () => {
  isCardView.value = !isCardView.value
}

const exportUrl = computed(() => `${API.evaluation_leaderboard_export}/${leaderboardOption.value}`)
const exportFileName = computed(() => `${departmentCode.value}-${leaderboardOption.value}-leaderboard-${route.query.year_month || 'current'}.xlsx`)

const csd_leaderboard = computed(() => csdStoreInstance.state.csdLeaderboard);

// true when somebody of the list is not submitted yet
const incomplete = computed(() =>
  csd_leaderboard.value.some(row => row.submitted === 0 || row.isCompleted === false)
)

// the images are served by the backend by filename
const updateImageLink = (imageLink) => {
  if (!imageLink) return ''
  if (imageLink.startsWith('data:image') || /^https?:\/\//.test(imageLink)) return imageLink
  return `${config.public.imageBaseUrl}${imageLink.split('/').pop()}`
}

// the rows of the details table of one employee
// bold colors of the rating descriptions (EXCEPTIONAL purple, VERY SATISFACTORY blue, SATISFACTORY green, UNSATISFACTORY and POOR red)
const descriptionColor = (description) => ({
  'EXCEPTIONAL': 'font-bold text-purple-500',
  'VERY SATISFACTORY': 'font-bold text-blue-500',
  'SATISFACTORY': 'font-bold text-green-500',
  'UNSATISFACTORY': 'font-bold text-red-500',
  'POOR': 'font-bold text-red-500',
}[description] || '')

// a leader whose leadership evaluation is answered: the Performance is the individual performance and the leadership performance
const isLeaderWithLeadership = (agent) => Boolean(agent.leadership_required) && Number(agent.leadership_score) > 0

const selectedAgentMetrics = computed(() => {
  const agent = selectedAgent
  // the absences, tardiness, memo and feedback are counted only when the evaluation is submitted
  const noData = agent.submitted != 1
  return [
    isLeaderWithLeadership(agent)
      ? { name: 'PERFORMANCE (80%)', result: '', scoreDescription: agent.performance_description, score: agent.performance_score, rating: agent.performance_rating }
      : { name: 'PERFORMANCE (80%)', result: `${agent.performance}%`, description: agent.performance_description, score: agent.performance_score, rating: agent.performance_rating },
    // the leaders (position level 7 - 10): the Performance score is the average of the individual performance score and the leadership score.
    // The PERFORMANCE row shows only the score and the rating, the two parts are the rows under it.
    ...(isLeaderWithLeadership(agent)
      ? [
          { name: '↳ Individual Performance (%)', result: `${agent.performance}%`, score: agent.team_performance_score, rating: '' },
          { name: '↳ Leadership Performance (score)', result: '', score: Number(Number(agent.leadership_score).toFixed(5)), rating: '' },
        ]
      : []),
    { name: 'ABSENCES (5%)', noData, result: agent.absences, score: agent.absence_score, rating: agent.absence_rating },
    { name: 'TARDINESS (5%)', noData, result: agent.tardiness, score: agent.tardiness_score, rating: agent.tardiness_rating },
    { name: 'MEMO (5%)', noData, result: agent.memo, score: agent.memo_score, rating: agent.memo_rating },
    { name: 'FEEDBACK (5%)', noData, result: agent.feedback_score, score: agent.feedback_score, rating: agent.feedback_rating },
  ]
})

const fetchCsdLeaderboard = (scope, query) => {
  csdStoreInstance.fetchLeaderboard(scope, null, { ...query, department: departmentCode.value });
};

const showAgentDetails = (agent) => {
  Object.assign(selectedAgent, agent);
  showModal.value = true;
};

const showTeamDetails = (team) => {
  Object.assign(selectedTeam, team);
  showModalForTeam.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

const closeModalForTeam = () => {
  showModalForTeam.value = false;
};

// the date or the scope is changed in the navigation bar
watch(() => route.query, (query) => {
  leaderboardOption.value = query.scope || 'agent'
  // the team board is only cards
  if (leaderboardOption.value == 'team') isCardView.value = true
  fetchCsdLeaderboard(leaderboardOption.value, query)
})

onMounted(() => {
  fetchCsdLeaderboard(leaderboardOption.value, route.query)
});

</script>

<style scoped>
/* Modal content */
.bg-gray-800 {
  max-height: 80vh; /* Set the maximum height to 80% of the viewport height */
  overflow-y: auto;  /* Allow vertical scrolling if content exceeds max height */
}
</style>
