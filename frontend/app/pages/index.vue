<script lang="ts" setup>
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


/**
 *
 * Summary Exemple:
 *
 * {
 *     "period": {
 *         "startDate": "2026-01-01",
 *         "endDate": "2026-01-28"
 *     },
 *     "summary": {
 *         "_id": null,
 *         "totalTickets": 978,
 *         "totalBillable": 316,
 *         "totalCreditRisk": 20,
 *         "totalCoDelivery": 70,
 *         "totalNRSSO": 138
 *     },
 *     "types": [
 *         {
 *             "type": "Consultation",
 *             "count": 121
 *         },
 *         {
 *             "type": "Break/Fix",
 *             "count": 746
 *         },
 *         {
 *             "type": "Parts",
 *             "count": 29
 *         },
 *         {
 *             "type": "Provisioning (MAC)",
 *             "count": 11
 *         },
 *         {
 *             "type": "Internal",
 *             "count": 62
 *         },
 *         {
 *             "type": "Provisioning Parts",
 *             "count": 2
 *         },
 *         {
 *             "type": "Installation",
 *             "count": 7
 *         }
 *     ],
 *     "list": [
 *         {
 *             "event_id": "33642575",
 *             "activity_number": "1-23436769782",
 *             "billable": "0",
 *             "co_delivery": "0",
 *             "credit_risk": "0",
 *             "customer_name": "NRSSO_ROW- Get Sold to from Customer",
 *             "user_flu_name": "Vinayak Y B (vyb)",
 *             "is_nrsso": "1",
 *             "entered_time_gmt": "29/01/2026 02:32:35"
 *         },
 *     ]
 * }
 */
const summary = ref()

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
const ticketList  = computed(() => summary.value.list )

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

  <header class="space-y-6">
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
          <button @click.prevent="filter" type="submit" class="text-white bg-brand box-border border border-transparent hover:bg-brand-strong focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-base text-sm px-4 py-2.5 focus:outline-none">Update</button>
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
          <dd class="font-light text-gray-500 dark:text-gray-400">NRRSSO</dd>
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


  <section v-if="hasSummary" class="bg-white dark:bg-gray-900">

    Total on this list: {{ ticketList.length }}

    <div class="relative overflow-x-auto bg-neutral-primary-soft shadow-xs rounded-base border border-default">
      <table class="w-full text-sm text-left rtl:text-right text-body">
        <thead class="bg-neutral-secondary-soft border-b border-default">
          <tr>
          <th scope="col" class="px-6 py-3 font-medium">
            SR#
          </th>
          <th scope="col" class="px-6 py-3 font-medium">
            Date
          </th>
          <th scope="col" class="px-6 py-3 font-medium">
            Billable
          </th>
          <th scope="col" class="px-6 py-3 font-medium">
            Codelivery
          </th>
          <th scope="col" class="px-6 py-3 font-medium">
            Credit Risk
          </th>
          <th scope="col" class="px-6 py-3 font-medium">
            NRSSO
          </th>
          <th scope="col" class="px-6 py-3 font-medium">
            Customer
          </th>
          <th scope="col" class="px-6 py-3 font-medium">
            User
          </th>
        </tr>
        </thead>
        <tbody>
          <tr v-for="item in ticketList" class="odd:bg-neutral-primary even:bg-neutral-secondary-soft border-b border-default">
            <th scope="row" class="px-6 py-4 font-medium text-heading whitespace-nowrap">
              {{ item.activity_number }}
            </th>
            <td class="px-6 py-4">
              {{ item.entered_time_gmt }}
            </td>
            <td class="px-6 py-4">
              {{ item.billable == 1 ? 'Yes' : 'No' }}
            </td>
            <td class="px-6 py-4">
              {{ item.co_delivery == 1 ? 'Yes' : 'No' }}
            </td>
            <td class="px-6 py-4">
              {{ item.credit_risk == 1 ? 'Yes' : 'No' }}
            </td>
            <td class="px-6 py-4">
              {{ item.is_nrsso == 1 ? 'Yes' : 'No' }}
            </td>
            <td class="px-6 py-4">
              {{ item.customer_name }}
            </td>
            <td class="px-6 py-4">
              {{ item.user_flu_name }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>


  </section>



</template>
