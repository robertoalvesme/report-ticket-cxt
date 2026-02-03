<script lang="ts" setup>
import { ref, computed } from 'vue'

defineOptions({
  tags: ['barcharts', 'vertical']
})

const props = withDefaults(defineProps<{
  showTitle?: boolean,
}>(), {
  showTitle: true
})

// --- Helper de Data ---
const formatDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// --- Estados ---
const datestart = ref<string>(formatDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)))
const dateend = ref<string>(formatDate(new Date()))
const isLoading = ref(false)
const summary = ref()

const RevenueCategories = computed(() => ({
  desktop: {
    name: 'Tickets',
    // color: '#22c55e'
  }
}))

// --- Filtros Estáticos (Iniciam True) ---
const showBillable = ref(true)
const showCodelivery = ref(true)
const showCreditRisk = ref(true)
const showNRSSO = ref(true)
const showOthers = ref(true)

// --- Filtros Dinâmicos ---
const availableTypes = ref<string[]>([])
const selectedTypes = ref<string[]>([])

const availableSkills = ref<string[]>([])
const selectedSkills = ref<string[]>([])

// --- Ações de UI (Select All) ---
const toggleAllTypes = () => {
  if (selectedTypes.value.length === availableTypes.value.length) {
    selectedTypes.value = []
  } else {
    selectedTypes.value = [...availableTypes.value]
  }
}

const toggleAllSkills = () => {
  if (selectedSkills.value.length === availableSkills.value.length) {
    selectedSkills.value = []
  } else {
    selectedSkills.value = [...availableSkills.value]
  }
}

const isAllTypesSelected = computed(() => availableTypes.value.length > 0 && selectedTypes.value.length === availableTypes.value.length)
const isAllSkillsSelected = computed(() => availableSkills.value.length > 0 && selectedSkills.value.length === availableSkills.value.length)

// --- Fetch Data ---
const filter = async () => {
  if (isLoading.value) return

  isLoading.value = true
  try {
    const params = new URLSearchParams({
      startDate: datestart.value,
      endDate: dateend.value
    })

    const res = await fetch(`http://localhost:5000/api/dashboard?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })

    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    const data = await res.json()
    console.log('dashboard data', data)
    summary.value = data

    // --- RESET TOTAL DE FILTROS ---
    // 1. Resetar filtros estáticos para o padrão (mostrar tudo)
    showBillable.value = true
    showCodelivery.value = true
    showCreditRisk.value = true
    showNRSSO.value = true
    showOthers.value = true

    // 2. Recalcular e Resetar filtros dinâmicos
    if (data.list && Array.isArray(data.list)) {
      const typesSet = new Set<string>()
      const skillsSet = new Set<string>()

      data.list.forEach((item: any) => {
        // Garante que mesmo valores nulos entrem como uma categoria selecionável
        const t = item.activity_type_name || 'Unspecified'
        const s = item.activity_skill_name || 'Unspecified'
        typesSet.add(t)
        skillsSet.add(s)

        // Normaliza no objeto também para facilitar o filtro depois
        item.activity_type_name = t
        item.activity_skill_name = s
      })

      availableTypes.value = Array.from(typesSet).sort()
      availableSkills.value = Array.from(skillsSet).sort()

      // Seleciona TODOS por padrão após o update
      selectedTypes.value = [...availableTypes.value]
      selectedSkills.value = [...availableSkills.value]
    }

  } catch (err) {
    console.error('Failed to fetch dashboard:', err)
  } finally {
    isLoading.value = false
  }
}

// --- KPIs: Total Absoluto (Baseado no retorno da API, não no filtro visual) ---
const hasSummary = computed(() => summary.value && summary.value.list)

// AQUI: Usamos o tamanho total da lista bruta para garantir que bata com o backend (1047)
const totalTickets = computed(() => summary.value?.list?.length ?? 0)

// KPIs Dinâmicos (Calculados a partir da lista filtrada para consistência visual dos cards coloridos)
// Se você quiser que os Cards de Billable/Etc sejam fixos (total do banco), mude ticketList.value para summary.value.list
const totalBillable = computed(() =>
    ticketList.value.filter((i: any) => i.billable === 1 || i.billable === true).length
)

const totalCreditRisk = computed(() =>
    ticketList.value.filter((i: any) => i.credit_risk === 1 || i.credit_risk === true).length
)

const totalCoDelivery = computed(() =>
    ticketList.value.filter((i: any) => i.co_delivery === 1 || i.co_delivery === true).length
)

const totalNRSSO = computed(() =>
    ticketList.value.filter((i: any) => i.nrsso === 1 || i.nrsso === true).length
)

// --- Lógica de Filtragem ---
const ticketList = computed(() => {
  const items = summary.value?.list ?? []
  const isTrue = (v: any) => v === 1 || v === '1' || v === true

  return items.filter((item: any) => {
    // 1. Type (Garante match exato com o valor normalizado)
    if (!selectedTypes.value.includes(item.activity_type_name)) return false

    // 2. Skill
    if (!selectedSkills.value.includes(item.activity_skill_name)) return false

    // 3. Categorias
    const isBillable = isTrue(item.billable)
    const isCoDelivery = isTrue(item.co_delivery)
    const isCreditRisk = isTrue(item.credit_risk)
    const isNRSSO = isTrue(item.nrsso)

    const isSpecialCategory = isBillable || isCoDelivery || isCreditRisk || isNRSSO

    if (!isSpecialCategory) {
      return showOthers.value
    }

    if (isBillable && showBillable.value) return true
    if (isCoDelivery && showCodelivery.value) return true
    if (isCreditRisk && showCreditRisk.value) return true
    if (isNRSSO && showNRSSO.value) return true

    return false
  })
})

const RevenueData = computed(() => {
  const items = (summary.value?.types ?? []) as Array<{ type: string; count: number }>
  return items.slice().sort((a, b) => b.count - a.count)
})

const xFormatter = (n: number): string => {
  const item = RevenueData.value[n]
  return item?.type ?? n.toString()
}

const yFormatter = (tick: number) => tick.toString()
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
    <div class="max-w-7xl mx-auto space-y-8">

      <section class="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">CXT Tickets Report</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Analytical dashboard for service requests</p>
          </div>
        </div>

        <form @submit.prevent="filter" class="grid gap-6 md:grid-cols-3 items-end">
          <div>
            <label for="datestart" class="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Start Date</label>
            <input
                v-model="datestart"
                type="date"
                id="datestart"
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                required
            />
          </div>
          <div>
            <label for="dateend" class="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">End Date</label>
            <input
                v-model="dateend"
                type="date"
                id="dateend"
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                required
            />
          </div>
          <div>
            <button
                type="submit"
                :disabled="isLoading"
                class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            >
              <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isLoading ? 'Loading data...' : 'Update Report' }}
            </button>
          </div>
        </form>
      </section>

      <section v-if="hasSummary">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div class="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition hover:shadow-md">
            <dt class="mb-2 text-3xl font-extrabold text-gray-900 dark:text-white">{{ totalTickets }}</dt>
            <dd class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Tickets</dd>
          </div>
          <div class="p-6 bg-green-50 dark:bg-gray-800 rounded-lg border border-green-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition hover:shadow-md">
            <dt class="mb-2 text-3xl font-extrabold text-green-600 dark:text-green-400">{{ totalBillable }}</dt>
            <dd class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Billable</dd>
          </div>
          <div class="p-6 bg-red-50 dark:bg-gray-800 rounded-lg border border-red-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition hover:shadow-md">
            <dt class="mb-2 text-3xl font-extrabold text-red-600 dark:text-red-400">{{ totalCreditRisk }}</dt>
            <dd class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Credit Risk</dd>
          </div>
          <div class="p-6 bg-blue-50 dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition hover:shadow-md">
            <dt class="mb-2 text-3xl font-extrabold text-blue-600 dark:text-blue-400">{{ totalCoDelivery }}</dt>
            <dd class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Co-Delivery</dd>
          </div>
          <div class="p-6 bg-purple-50 dark:bg-gray-800 rounded-lg border border-purple-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition hover:shadow-md">
            <dt class="mb-2 text-3xl font-extrabold text-purple-600 dark:text-purple-400">{{ totalNRSSO }}</dt>
            <dd class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">NRSSO</dd>
          </div>
        </div>
      </section>

      <section v-if="hasSummary" class="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">Tickets Volume by Type</h3>
        </div>
        <div class="w-full">
          <BarChart
              :y-axis="['count']"
              :data="RevenueData"
              :categories="RevenueCategories"
              :x-formatter="xFormatter"
              :height="320"
              :x-num-ticks="6"
              :radius="4"
              :y-grid-line="true"
              :y-formatter="yFormatter"
              :legend-position="LegendPosition.TopRight"
              :hide-legend="false"
          />
        </div>
      </section>

      <section v-if="hasSummary" class="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">Detailed Filters</h3>
          <span class="text-xs text-gray-500">Refine the table below</span>
        </div>

        <div class="mb-8">
          <span class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Status Categories</span>
          <div class="flex flex-wrap gap-4">
            <label class="inline-flex items-center cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition">
              <input type="checkbox" v-model="showBillable" class="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Billable</span>
            </label>
            <label class="inline-flex items-center cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition">
              <input type="checkbox" v-model="showCodelivery" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Co-delivery</span>
            </label>
            <label class="inline-flex items-center cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition">
              <input type="checkbox" v-model="showCreditRisk" class="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Credit Risk</span>
            </label>
            <label class="inline-flex items-center cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition">
              <input type="checkbox" v-model="showNRSSO" class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">NRSSO</span>
            </label>
            <label class="inline-flex items-center cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition">
              <input type="checkbox" v-model="showOthers" class="w-4 h-4 text-gray-600 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 dark:focus:ring-gray-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Others (Standard)</span>
            </label>
          </div>
        </div>

        <hr class="h-px my-6 bg-gray-200 border-0 dark:bg-gray-700">

        <div class="mb-8">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket Types</span>
            <button
                @click="toggleAllTypes"
                class="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              {{ isAllTypesSelected ? 'Deselect All' : 'Select All' }}
            </button>
          </div>
          <div class="flex flex-wrap gap-x-6 gap-y-3">
            <label v-for="type in availableTypes" :key="type" class="inline-flex items-center cursor-pointer">
              <input type="checkbox" :value="type" v-model="selectedTypes" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="ml-2 text-sm text-gray-600 dark:text-gray-300">{{ type }}</span>
            </label>
          </div>
        </div>

        <hr class="h-px my-6 bg-gray-200 border-0 dark:bg-gray-700">

        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Skills / Products</span>
            <button
                @click="toggleAllSkills"
                class="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              {{ isAllSkillsSelected ? 'Deselect All' : 'Select All' }}
            </button>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <label v-for="skill in availableSkills" :key="skill" class="inline-flex items-center cursor-pointer group">
              <input type="checkbox" :value="skill" v-model="selectedSkills" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="ml-2 text-sm text-gray-600 dark:text-gray-300 truncate group-hover:text-gray-900 transition-colors" :title="skill">{{ skill }}</span>
            </label>
          </div>
        </div>
      </section>

      <section v-if="hasSummary" class="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">

        <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">Ticket Details</h3>
          <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
            {{ ticketList.length }} Records Found
          </span>
        </div>

        <div class="overflow-x-auto w-full">
          <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">SR#</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">Date (GMT)</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">Type</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">Skill</th>
              <th scope="col" class="px-6 py-3 text-center">Flags</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">Customer</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">Engineer</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="item in ticketList" :key="item.event_id" class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
              <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                {{ item.activity_number }}
              </th>
              <td class="px-6 py-4 whitespace-nowrap">
                {{ item.entered_time_gmt }}
              </td>
              <td class="px-6 py-4 font-medium text-gray-800 dark:text-gray-200">
                {{ item.activity_type_name }}
              </td>
              <td class="px-6 py-4">
                {{ item.activity_skill_name }}
              </td>

              <td class="px-6 py-4">
                <div class="flex gap-2 justify-center">
                  <span v-if="item.billable" title="Billable" class="px-2 py-1 text-xs font-bold text-green-700 bg-green-100 rounded border border-green-200">BIL</span>
                  <span v-if="item.co_delivery" title="Co-Delivery" class="px-2 py-1 text-xs font-bold text-blue-700 bg-blue-100 rounded border border-blue-200">COD</span>
                  <span v-if="item.credit_risk" title="Credit Risk" class="px-2 py-1 text-xs font-bold text-red-700 bg-red-100 rounded border border-red-200">RSK</span>
                  <span v-if="item.nrsso" title="NRSSO" class="px-2 py-1 text-xs font-bold text-purple-700 bg-purple-100 rounded border border-purple-200">NRS</span>
                  <span v-if="!item.billable && !item.co_delivery && !item.credit_risk && !item.nrsso" class="text-gray-300">-</span>
                </div>
              </td>

              <td class="px-6 py-4 truncate max-w-[200px]" :title="item.customer_name">
                {{ item.customer_name }}
              </td>
              <td class="px-6 py-4 truncate max-w-[150px]" :title="item.user_flu_name">
                {{ item.user_flu_name }}
              </td>
            </tr>

            <tr v-if="ticketList.length === 0">
              <td colspan="7" class="px-6 py-12 text-center text-gray-500 bg-gray-50 dark:bg-gray-800">
                <div class="flex flex-col items-center justify-center">
                  <svg class="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <p class="text-base font-medium">No tickets found matching your filters.</p>
                </div>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>
  </div>
</template>