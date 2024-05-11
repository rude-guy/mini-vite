import { NextHandleFunction } from 'connect';
//  一个用于加载静态资源的中间件
import sirv from 'sirv';
import { isImportRequest } from '../../util';

export function staticMiddleware(root: string): NextHandleFunction {
  const serveFromRoot = sirv(root, { dev: true });
  return (req, res, next) => {
    if (!req.url) {
      return;
    }
    // 不处理 import 请求
    if (isImportRequest(req.url)) {
      return;
    }
    serveFromRoot(req, res, next);
  };
}
