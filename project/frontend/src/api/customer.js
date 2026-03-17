import request from './request'

export const customerApi = {
  getMessages: (params) => request.get('/customer/messages', { params }),
  getTemplates: () => request.get('/customer/templates'),
  createTemplate: (data) => request.post('/customer/templates', data),
  updateTemplate: (id, data) => request.put(`/customer/templates/${id}`, data),
  deleteTemplate: (id) => request.delete(`/customer/templates/${id}`),
  getRules: () => request.get('/customer/rules'),
  createRule: (data) => request.post('/customer/rules', data),
  updateRule: (id, data) => request.put(`/customer/rules/${id}`, data),
  deleteRule: (id) => request.delete(`/customer/rules/${id}`),
  getStats: (params) => request.get('/customer/stats', { params })
}
