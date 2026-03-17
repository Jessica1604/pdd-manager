import request from './request'

export const dashboardApi = {
  getSummary: (shopId) => request.get('/dashboard/summary', { params: { shopId } }),
  getTrend: (shopId, days = 7) => request.get('/dashboard/trend', { params: { shopId, days } }),
  getTopGoods: (shopId, days = 30) => request.get('/dashboard/top-goods', { params: { shopId, days } }),
  getStockWarnings: (shopId) => request.get('/dashboard/stock-warnings', { params: { shopId } })
}
