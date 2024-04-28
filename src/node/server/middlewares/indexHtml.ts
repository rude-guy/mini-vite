import { NextHandleFunction } from 'connect';
import { ServerContext } from '../index';
import path from 'path';
import fs from 'fs-extra';

export function middlewareIndexHtml(
  serverContext: ServerContext
): NextHandleFunction {
  return async (req, res, next) => {
    if (req.url === '/') {
      const { root } = serverContext;
      // 默认使用项目根目录下的 index.html
      const indexHtmlPath = path.join(root, 'index.html');
      if (await fs.pathExists(indexHtmlPath)) {
        const rawHtml = await fs.readFile(indexHtmlPath, 'utf-8');
        let html = rawHtml;
        // 通过执行插件的 transformIndexHtml 方法来对 HTML 进行自定义的修改
        for (const plugin of serverContext.plugins) {
          if (typeof plugin.transformIndexHtml === 'function') {
            html = await plugin.transformIndexHtml(html);
          }
        }

        res.statusCode = 200;
        res.setHeader('Content-type', 'text/html');
        return res.end(html);
      }
    }
    return next();
  };
}
