import request from './request'

const SHOP_ID = 1

export const analyticsApi = {
  getSummary: (startDate, endDate) => request.get('/analytics/summary', { params: { shopId: SHOP_ID, startDate, endDate } }),
  getTrend: (days = 7) => request.get('/analytics/trend', { params: { shopId: SHOP_ID, days } }),
  getTopGoods: (startDate, endDate, limit = 10) => request.get('/analytics/top-goods', { params: { shopId: SHOP_ID, startDate, endDate, limit } }),
  getStockAnalysis: () => request.get('/analytics/stock', { params: { shopId: SHOP_ID } }),
  generateDaily: () => request.post('/report/daily', { shopId: SHOP_ID }),
  generateWeekly: () => request.post('/report/weekly', { shopId: SHOP_ID })
}
