'use strict';

/**
 * 异步路由包装器
 * 将 async 路由函数的 rejected Promise 自动转发给 next(err)
 *
 * 用法：
 *   router.get('/path', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOp();
 *     res.json({ code: 0, data });
 *   }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
