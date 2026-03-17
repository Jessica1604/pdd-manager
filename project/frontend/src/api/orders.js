import request from './request'

const SHOP_ID = 1

export const ordersApi = {
  getList: (params) => request.get('/orders', { params: { shopId: SHOP_ID, ...params } }),
  ship: (orderSn, trackingNumber) => request.post(`/orders/${orderSn}/ship`, { shopId: SHOP_ID, trackingNumber }),
  batchShip: (list) => request.post('/orders/batch-ship', { shopId: SHOP_ID, list }),
  sync: () => request.post('/sync/orders', { shopId: SHOP_ID })
}
