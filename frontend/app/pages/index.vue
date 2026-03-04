<script lang="ts" setup>
import { ref, computed } from 'vue'
import * as XLSX from 'xlsx'

defineOptions({
  tags: ['barcharts', 'vertical']
})

// --- Helper de Data ---
const formatDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// --- Estados Principais ---
const datestart = ref<string>(formatDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)))
const dateend = ref<string>(formatDate(new Date()))
const isLoading = ref(false)
const summary = ref()

// --- Estado do Sync Manual ---
const syncingId = ref<string | null>(null) // Guarda o ID do ticket que está sendo atualizado no momento

// --- Estado do Modal ---
const showModal = ref(false)
const modalTitle = ref('')
const modalMessage = ref('')
const modalType = ref<'success' | 'error'>('success')

const openModal = (title: string, message: string, type: 'success' | 'error' = 'success') => {
  modalTitle.value = title
  modalMessage.value = message
  modalType.value = type
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

// --- Configuração Gráfico ---
const RevenueCategories = computed(() => ({
  desktop: {
    name: 'Tickets',
  }
}))

// --- Filtros Estáticos ---
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

// --- Ações de UI ---
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

// --- Fetch Data (Dashboard) ---
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
    showBillable.value = true
    showCodelivery.value = true
    showCreditRisk.value = true
    showNRSSO.value = true
    showOthers.value = true

    if (data.list && Array.isArray(data.list)) {
      const typesSet = new Set<string>()
      const skillsSet = new Set<string>()

      data.list.forEach((item: any) => {
        const t = item.activity_type_name || 'Unspecified'
        const s = item.activity_skill_name || 'Unspecified'
        typesSet.add(t)
        skillsSet.add(s)
        item.activity_type_name = t
        item.activity_skill_name = s
      })

      availableTypes.value = Array.from(typesSet).sort()
      availableSkills.value = Array.from(skillsSet).sort()
      selectedTypes.value = [...availableTypes.value]
      selectedSkills.value = [...availableSkills.value]
    }

  } catch (err) {
    console.error('Failed to fetch dashboard:', err)
  } finally {
    isLoading.value = false
  }
}

// --- Ação: Sync Manual de Ticket ---
const syncTicket = async (activityNumber: string) => {
  if (syncingId.value) return // Evita múltiplos cliques

  syncingId.value = activityNumber
  try {
    const res = await fetch(`http://localhost:5000/api/tickets/${activityNumber}/sync`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    })

    const data = await res.json()

    if (!res.ok) throw new Error(data.error || 'Failed to sync')

    openModal('Sync Complete', `Ticket ${activityNumber} details updated successfully.`, 'success')

    // Opcional: Se quiser atualizar a linha na tabela localmente sem reload completo:
    // const item = summary.value.list.find((t: any) => t.activity_number === activityNumber)
    // if(item && data.data) {
    //    item.source = data.data.source
    //    item.resolutionNote = data.data.resolutionNote
    //    item.updated = true
    // }

  } catch (err: any) {
    console.error(err)
    openModal('Sync Failed', err.message, 'error')
  } finally {
    syncingId.value = null
  }
}

// --- KPIs ---
const hasSummary = computed(() => summary.value && summary.value.list)
const totalTickets = computed(() => summary.value?.list?.length ?? 0)

const totalBillable = computed(() => summary.value?.summary?.totalBillable ?? 0)
const totalCreditRisk = computed(() => summary.value?.summary?.totalCreditRisk ?? 0)
const totalCoDelivery = computed(() => summary.value?.summary?.totalCoDelivery ?? 0)
const totalNRSSO = computed(() => summary.value?.summary?.totalNRSSO ?? 0)

// --- Lógica de Filtro ---
const ticketList = computed(() => {
  const items = summary.value?.list ?? []
  const isTrue = (v: any) => v === 1 || v === '1' || v === true

  return items.filter((item: any) => {
    if (!selectedTypes.value.includes(item.activity_type_name)) return false
    if (!selectedSkills.value.includes(item.activity_skill_name)) return false

    const isBillable = isTrue(item.billable)
    const isCoDelivery = isTrue(item.co_delivery)
    const isCreditRisk = isTrue(item.credit_risk)
    const isNRSSO = isTrue(item.nrsso)
    const isSpecialCategory = isBillable || isCoDelivery || isCreditRisk || isNRSSO

    if (!isSpecialCategory) return showOthers.value

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

// --- Exportar Excel ---
const downloadExcel = () => {
  const rawData = summary.value?.list ?? []
  if (rawData.length === 0) return

  const isTrue = (v: any) => v === 1 || v === '1' || v === true

  const excelData = rawData.map((item: any) => ({
    'SR#': item.activity_number,
    'Date (GMT)': item.entered_time_gmt,
    'Type': item.activity_type_name,
    'Skill': item.activity_skill_name,
    'Billable': isTrue(item.billable) ? 'Yes' : 'No',
    'Co-Delivery': isTrue(item.co_delivery) ? 'Yes' : 'No',
    'Credit Risk': isTrue(item.credit_risk) ? 'Yes' : 'No',
    'NRSSO': isTrue(item.nrsso) ? 'Yes' : 'No',
    // --- NOVAS COLUNAS ADICIONADAS ---
    'Hours Booked SD': item.hoursBooked ?? 0,
    'SR Age (Days)': item.srAgeDays || '',
    'Current Owner': item.srOwner || '',
    'First Service Action': item.serviceActionFirst || '',
    'Current Service Action': item.serviceAction || '',
    'Resolution Action': item.resolutionAction || '',
    'Resolution Detail': item.resolutionDetail || '',
    'Region': item.region || '',
    // ---------------------------------
    'Source': item.source || '',
    'Resolution Note': item.resolutionNote || '',
    'Customer': item.customer_name,
    'First Engineer Assigned': item.user_flu_name
  }))

  const worksheet = XLSX.utils.json_to_sheet(excelData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets')
  const fileName = `CXT_Report_${datestart.value}_to_${dateend.value}.xlsx`
  XLSX.writeFile(workbook, fileName)
}


</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 relative">

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-sm w-full mx-4 p-6 transform transition-all">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold" :class="modalType === 'success' ? 'text-green-600' : 'text-red-600'">
            {{ modalTitle }}
          </h3>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-500">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p class="text-gray-600 dark:text-gray-300 mb-6">
          {{ modalMessage }}
        </p>
        <div class="text-right">
          <button @click="closeModal" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>

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
            <input v-model="datestart" type="date" id="datestart" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
          </div>
          <div>
            <label for="dateend" class="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">End Date</label>
            <input v-model="dateend" type="date" id="dateend" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
          </div>
          <div>
            <button type="submit" :disabled="isLoading" class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all">
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
          <BarChart :y-axis="['count']" :data="RevenueData" :categories="RevenueCategories" :x-formatter="xFormatter" :height="320" :x-num-ticks="6" :radius="4" :y-grid-line="true" :y-formatter="yFormatter" :legend-position="LegendPosition.TopRight" :hide-legend="false" />
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
            <button @click="toggleAllTypes" class="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline">
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
            <button @click="toggleAllSkills" class="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline">
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

        <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">Ticket Details</h3>
            <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
              {{ ticketList.length }} Displayed
            </span>
          </div>

          <button @click="downloadExcel" class="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Download Excel ({{ totalTickets }})
          </button>
        </div>

        <div class="overflow-x-auto w-full">
          <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">SR#</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">Date (GMT)</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">Type</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">Details (Skill/Source/Res)</th>
              <th scope="col" class="px-6 py-3 text-center">Flags</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">Customer</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap">Engineer</th>
              <th scope="col" class="px-6 py-3 whitespace-nowrap text-center">Actions</th>
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

              <td class="px-6 py-4 align-top">
                <div class="flex flex-col gap-1 max-w-[250px]">
                    <span class="font-semibold text-gray-900 dark:text-white">
                      {{ item.activity_skill_name }}
                    </span>

                  <div class="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
                      <span v-if="item.source" class="inline-flex items-center">
                         <span class="font-medium mr-1">Source:</span> {{ item.source }}
                      </span>

                      <span v-if="item.region" class="italic truncate block" :title="item.region">
                        <span class="font-medium mr-1">Region:</span> {{ item.region }}
                      </span>

                      <span v-if="item.serviceActionFirst" class="italic truncate block" :title="item.serviceActionFirst">
                        <span class="font-medium mr-1">First Service Action:</span> {{ item.serviceActionFirst }}
                      </span>

                      <span v-if="item.serviceAction" class="italic truncate block" :title="item.serviceAction">
                        <span class="font-medium mr-1">Current Service Action:</span> {{ item.serviceAction }}
                      </span>

                      <span v-if="item.hoursBooked" class="italic truncate block" :title="item.hoursBooked">
                        <span class="font-medium mr-1">Hours Booked SD:</span> {{ item.hoursBooked }}
                      </span>

                      <span v-if="item.resolutionNote" class="italic truncate block" :title="item.resolutionNote">
                        <span class="font-medium mr-1">Resolution Note:</span> "{{ item.resolutionNote }}"
                      </span>

                      <span v-if="item.resolutionDetail" class="italic truncate block" :title="item.resolutionDetail">
                        <span class="font-medium mr-1">Resolution Detail:</span> "{{ item.resolutionDetail }}"
                      </span>

                  </div>
                </div>
              </td>

              <td class="px-6 py-4">
                <div class="flex flex-wrap gap-1 justify-center w-[120px] mx-auto">
                  <span v-if="item.billable" title="Billable" class="px-2 py-0.5 text-[10px] font-bold text-green-700 bg-green-100 rounded border border-green-200">BIL</span>
                  <span v-if="item.co_delivery" title="Co-Delivery" class="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-100 rounded border border-blue-200">COD</span>
                  <span v-if="item.credit_risk" title="Credit Risk" class="px-2 py-0.5 text-[10px] font-bold text-red-700 bg-red-100 rounded border border-red-200">RSK</span>
                  <span v-if="item.nrsso" title="NRSSO" class="px-2 py-0.5 text-[10px] font-bold text-purple-700 bg-purple-100 rounded border border-purple-200">NRS</span>
                  <span v-if="!item.billable && !item.co_delivery && !item.credit_risk && !item.nrsso" class="text-gray-300">-</span>
                </div>
              </td>

              <td class="px-6 py-4 truncate max-w-[150px]" :title="item.customer_name">
                {{ item.customer_name }}
              </td>

              <td class="px-6 py-4 truncate max-w-[120px]" :title="item.user_flu_name">
                {{ item.user_flu_name }}
              </td>

              <td class="px-6 py-4 text-center">
                <button
                    @click="syncTicket(item.activity_number)"
                    :disabled="syncingId === item.activity_number"
                    class="group relative inline-flex items-center justify-center p-2 rounded-full text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Update Details (Sync)"
                >
                  <svg v-if="syncingId === item.activity_number" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else class="w-5 h-5 transform group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                </button>
              </td>
            </tr>

            <tr v-if="ticketList.length === 0">
              <td colspan="8" class="px-6 py-12 text-center text-gray-500 bg-gray-50 dark:bg-gray-800">
                <div class="flex flex-col items-center justify-center">
                  <svg class="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
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