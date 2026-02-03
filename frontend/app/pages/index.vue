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

const formatDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const datestart = ref<string>(formatDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)))
const dateend = ref<string>(formatDate(new Date()))

const RevenueCategories = computed(() => ({
  desktop: {
    name: 'Tickets',
    // color: '#22c55e'
  }
}))

const summary = ref()

// --- Filtros Estáticos (Categorias) ---
const showBillable = ref(true)
const showCodelivery = ref(true)
const showCreditRisk = ref(true)
const showNRSSO = ref(true)
const showOthers = ref(true)

// --- Filtros Dinâmicos (Types e Skills) ---
const availableTypes = ref<string[]>([])
const selectedTypes = ref<string[]>([])

const availableSkills = ref<string[]>([])
const selectedSkills = ref<string[]>([])

const filter = async () => {
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

    // --- Popular Filtros Dinâmicos ---
    // Extrai valores únicos da lista recebida
    if (data.list && Array.isArray(data.list)) {
      const typesSet = new Set<string>()
      const skillsSet = new Set<string>()

      data.list.forEach((item: any) => {
        if (item.activity_type_name) typesSet.add(item.activity_type_name)
        if (item.activity_skill_name) skillsSet.add(item.activity_skill_name)
      })

      // Converte para array e ordena
      availableTypes.value = Array.from(typesSet).sort()
      availableSkills.value = Array.from(skillsSet).sort()

      // Padrão: Todos selecionados
      selectedTypes.value = [...availableTypes.value]
      selectedSkills.value = [...availableSkills.value]
    }

  } catch (err) {
    console.error('Failed to fetch dashboard:', err)
  }
}

const hasSummary = computed(() => summary.value && summary.value.summary )
const totalTickets = computed(() => summary.value.summary.totalTickets )
const totalBillable = computed(() => summary.value.summary.totalBillable )
const totalCreditRisk = computed(() => summary.value.summary.totalCreditRisk )
const totalCoDelivery = computed(() => summary.value.summary.totalCoDelivery )
const totalNRSSO = computed(() => summary.value.summary.totalNRSSO )


// --- Lógica de Filtragem Principal ---
const ticketList = computed(() => {
  const items = summary.value?.list ?? []
  const isTrue = (v: any) => v === 1 || v === '1' || v === true

  return items.filter((item: any) => {
    // 1. Filtro por TYPE (Excludente)
    if (!selectedTypes.value.includes(item.activity_type_name)) {
      return false
    }

    // 2. Filtro por SKILL (Excludente)
    if (!selectedSkills.value.includes(item.activity_skill_name)) {
      return false
    }

    // 3. Filtro por Categorias (Billable, NRSSO, etc...)
    const isBillable = isTrue(item.billable)
    const isCoDelivery = isTrue(item.co_delivery)
    const isCreditRisk = isTrue(item.credit_risk)
    const isNRSSO = isTrue(item.nrsso)

    const isSpecialCategory = isBillable || isCoDelivery || isCreditRisk || isNRSSO

    // Se NÃO é especial, obedece ao 'showOthers'
    if (!isSpecialCategory) {
      return showOthers.value
    }

    // Se É especial, verifica se a categoria específica está ativa
    if (isBillable && showBillable.value) return true
    if (isCoDelivery && showCodelivery.value) return true
    if (isCreditRisk && showCreditRisk.value) return true
    if (isNRSSO && showNRSSO.value) return true

    // Se tem categoria especial mas todas foram desmarcadas
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

  <header class="space-y-10 mt-10">
    <form>
      <div class="grid gap-6 mb-6 md:grid-cols-3 md:w-3xl mx-auto">
        <div>
          <label for="datestart" class="block mb-2.5 text-sm font-medium text-heading">Start Date</label>
          <input v-model="datestart" type="date" id="datestart" class="bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand block w-full px-3 py-2.5 shadow-xs placeholder:text-body" required />
        </div>
        <div>
          <label for="dateend" class="block mb-2.5 text-sm font-medium text-heading">End Date</label>
          <input v-model="dateend" type="date" id="dateend" class="bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand block w-full px-3 py-2.5 shadow-xs placeholder:text-body" required />
        </div>
        <div>
          <button @click.prevent="filter" type="button" class="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
            Update
          </button>
        </div>
      </div>
    </form>
  </header>

  <section v-if="hasSummary" class="bg-white dark:bg-gray-900">
    <div class="max-w-7xl px-4 py-8 mx-auto text-center lg:py-16 lg:px-6">
      <dl class="grid max-w-3xl gap-8 mx-auto text-gray-900 sm:grid-cols-5 dark:text-white">
        <div class="flex flex-col items-center justify-center">
          <dt class="mb-2 text-3xl md:text-4xl font-extrabold">{{ totalTickets }}</dt>
          <dd class="font-light text-gray-500 dark:text-gray-400">Tickets</dd>
        </div>
        <div class="flex flex-col items-center justify-center">
          <dt class="mb-2 text-3xl md:text-4xl font-extrabold">{{ totalBillable }}</dt>
          <dd class="font-light text-gray-500 dark:text-gray-400">Billable</dd>
        </div>
        <div class="flex flex-col items-center justify-center">
          <dt class="mb-2 text-3xl md:text-4xl font-extrabold">{{ totalCreditRisk }}</dt>
          <dd class="font-light text-gray-500 dark:text-gray-400">Credit Risk</dd>
        </div>
        <div class="flex flex-col items-center justify-center">
          <dt class="mb-2 text-3xl md:text-4xl font-extrabold">{{ totalCoDelivery }}</dt>
          <dd class="font-light text-gray-500 dark:text-gray-400">Co-Delivery</dd>
        </div>
        <div class="flex flex-col items-center justify-center">
          <dt class="mb-2 text-3xl md:text-4xl font-extrabold">{{ totalNRSSO }}</dt>
          <dd class="font-light text-gray-500 dark:text-gray-400">NRSSO</dd>
        </div>
      </dl>
    </div>
  </section>

  <section v-if="hasSummary" class="mx-auto max-w-3xl space-y-6 rounded-lg" :class="showTitle ? 'p-6' : ''">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">
        Tickets by type
      </h3>
    </div>
    <BarChart
        :y-axis="['count']"
        :data="RevenueData"
        :categories="RevenueCategories"
        :x-formatter="xFormatter"
        :height="300"
        :x-num-ticks="6"
        :radius="4"
        :y-grid-line="true"
        :y-formatter="yFormatter"
        :legend-position="LegendPosition.TopRight"
        :hide-legend="false"
    />
  </section>

  <section v-if="hasSummary" class="max-w-7xl px-4 py-8 mx-auto bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200">
    <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Filters</h3>

    <div class="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
      <span class="block text-sm font-medium text-gray-700 mb-3">Categories</span>
      <div class="flex flex-wrap gap-4">
        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showBillable" class="form-checkbox h-5 w-5 text-blue-600 rounded" />
          <span class="ml-2 text-gray-700">Billable</span>
        </label>
        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showCodelivery" class="form-checkbox h-5 w-5 text-blue-600 rounded" />
          <span class="ml-2 text-gray-700">Co-delivery</span>
        </label>
        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showCreditRisk" class="form-checkbox h-5 w-5 text-blue-600 rounded" />
          <span class="ml-2 text-gray-700">Credit Risk</span>
        </label>
        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showNRSSO" class="form-checkbox h-5 w-5 text-blue-600 rounded" />
          <span class="ml-2 text-gray-700">NRSSO</span>
        </label>
        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showOthers" class="form-checkbox h-5 w-5 text-blue-600 rounded" />
          <span class="ml-2 text-gray-700">Others (Standard)</span>
        </label>
      </div>
    </div>

    <div class="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
      <span class="block text-sm font-medium text-gray-700 mb-3">Ticket Types</span>
      <div class="flex flex-wrap gap-x-6 gap-y-2">
        <label v-for="type in availableTypes" :key="type" class="inline-flex items-center cursor-pointer">
          <input type="checkbox" :value="type" v-model="selectedTypes" class="form-checkbox h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500" />
          <span class="ml-2 text-sm text-gray-600">{{ type }}</span>
        </label>
      </div>
    </div>

    <div>
      <span class="block text-sm font-medium text-gray-700 mb-3">Skills</span>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        <label v-for="skill in availableSkills" :key="skill" class="inline-flex items-center cursor-pointer">
          <input type="checkbox" :value="skill" v-model="selectedSkills" class="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
          <span class="ml-2 text-sm text-gray-600 truncate" :title="skill">{{ skill }}</span>
        </label>
      </div>
    </div>
  </section>

  <section v-if="hasSummary" class="bg-white dark:bg-gray-900 mb-10">

    <div class="px-6 py-4 text-sm text-gray-500">
      Showing <strong>{{ ticketList.length }}</strong> tickets based on current filters.
    </div>

    <div class="relative overflow-x-auto bg-neutral-primary-soft shadow-xs rounded-base border border-default">
      <table class="w-full text-sm text-left rtl:text-right text-body">
        <thead class="bg-neutral-secondary-soft border-b border-default">
        <tr>
          <th scope="col" class="px-6 py-3 font-medium">SR#</th>
          <th scope="col" class="px-6 py-3 font-medium">Date</th>
          <th scope="col" class="px-6 py-3 font-medium">Type</th>
          <th scope="col" class="px-6 py-3 font-medium">Skill</th>
          <th scope="col" class="px-6 py-3 font-medium">Billable</th>
          <th scope="col" class="px-6 py-3 font-medium">Codelivery</th>
          <th scope="col" class="px-6 py-3 font-medium">Credit Risk</th>
          <th scope="col" class="px-6 py-3 font-medium">NRSSO</th>
          <th scope="col" class="px-6 py-3 font-medium">Customer</th>
          <th scope="col" class="px-6 py-3 font-medium">User</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="item in ticketList" :key="item.event_id" class="odd:bg-neutral-primary even:bg-neutral-secondary-soft border-b border-default hover:bg-gray-50">
          <th scope="row" class="px-6 py-4 font-medium text-heading whitespace-nowrap">
            {{ item.activity_number }}
          </th>
          <td class="px-6 py-4 whitespace-nowrap">{{ item.entered_time_gmt }}</td>
          <td class="px-6 py-4 font-semibold text-gray-600">{{ item.activity_type_name }}</td>
          <td class="px-6 py-4 text-gray-600">{{ item.activity_skill_name }}</td>

          <td class="px-6 py-4">
            <span v-if="item.billable" class="px-2 py-1 text-xs font-bold text-green-800 bg-green-100 rounded-full">Yes</span>
            <span v-else class="text-gray-400">-</span>
          </td>
          <td class="px-6 py-4">
            <span v-if="item.co_delivery" class="px-2 py-1 text-xs font-bold text-blue-800 bg-blue-100 rounded-full">Yes</span>
            <span v-else class="text-gray-400">-</span>
          </td>
          <td class="px-6 py-4">
            <span v-if="item.credit_risk" class="px-2 py-1 text-xs font-bold text-red-800 bg-red-100 rounded-full">Yes</span>
            <span v-else class="text-gray-400">-</span>
          </td>
          <td class="px-6 py-4">
            <span v-if="item.nrsso" class="px-2 py-1 text-xs font-bold text-purple-800 bg-purple-100 rounded-full">Yes</span>
            <span v-else class="text-gray-400">-</span>
          </td>
          <td class="px-6 py-4 text-gray-700 truncate max-w-xs" :title="item.customer_name">
            {{ item.customer_name }}
          </td>
          <td class="px-6 py-4 text-gray-700">
            {{ item.user_flu_name }}
          </td>
        </tr>
        </tbody>
      </table>

      <div v-if="ticketList.length === 0" class="p-10 text-center text-gray-500">
        No tickets found matching the selected filters.
      </div>
    </div>
  </section>

</template>