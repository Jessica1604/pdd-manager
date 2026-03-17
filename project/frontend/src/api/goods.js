import request from './request'

const SHOP_ID = 1

export const goodsApi = {
  getList: (params) => request.get('/goods', { params: { shopId: SHOP_ID, ...params } }),
  update: (goodsId, data) => request.put(`/goods/${goodsId}`, { shopId: SHOP_ID, ...data }),
  batchUpdateStatus: (goodsIds, onSale) => request.post('/goods/batch-status', { shopId: SHOP_ID, goodsIds, onSale }),
  sync: () => request.post('/sync/goods', { shopId: SHOP_ID })
}
