import { defineStore } from 'pinia'
import { ref } from 'vue'
import { goodsApi } from '@/api/goods'

export const useGoodsStore = defineStore('goods', () => {
  const list = ref([])
  const total = ref(0)
  const loading = ref(false)
  const params = ref({ page: 1, pageSize: 20, status: '', keyword: '' })

  async function fetchList() {
    loading.value = true
    try {
      const data = await goodsApi.getList(params.value)
      list.value = data.list
      total.value = data.total
    } finally {
      loading.value = false
    }
  }

  async function updateGoods(goodsId, payload) {
    await goodsApi.update(goodsId, payload)
    await fetchList()
  }

  async function updateStock(goodsId, stock) {
    await goodsApi.update(goodsId, { stock })
    const item = list.value.find(g => g.goods_id === goodsId)
    if (item) item.stock = stock
  }

  async function batchUpdateStatus(goodsIds, onSale) {
    await goodsApi.batchUpdateStatus(goodsIds, onSale)
    await fetchList()
  }

  return { list, total, loading, params, fetchList, updateGoods, updateStock, batchUpdateStatus }
})
