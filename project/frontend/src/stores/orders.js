import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ordersApi } from '@/api/orders'

export const useOrdersStore = defineStore('orders', () => {
  const list = ref([])
  const total = ref(0)
  const loading = ref(false)
  const params = ref({ page: 1, pageSize: 20, status: '', startTime: '', endTime: '' })

  async function fetchList() {
    loading.value = true
    try {
      const data = await ordersApi.getList(params.value)
      list.value = data.list
      total.value = data.total
    } finally {
      loading.value = false
    }
  }

  async function shipOrder(orderSn, trackingNumber) {
    await ordersApi.ship(orderSn, trackingNumber)
    // 本地更新状态，避免重新请求
    const item = list.value.find(o => o.order_sn === orderSn)
    if (item) {
      item.status = 'shipped'
      item.tracking_number = trackingNumber
    }
  }

  async function batchShip(list) {
    await ordersApi.batchShip(list)
    await fetchList()
  }

  return { list, total, loading, params, fetchList, shipOrder, batchShip }
})
