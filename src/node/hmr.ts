import { blue, green } from 'picocolors';
import { ServerContext } from './server';
import { getShortName } from './util';

export function bindingHMREvents(serverContext: ServerContext) {
  const { watcher, ws, root, moduleGraph } = serverContext;

  watcher.on('change', async (file) => {
    console.log(`✨${blue('[hmr]')} ${green(file)} changed`);
    // 清除模块依赖图中的缓存
    await moduleGraph.invalidateModule(file);
    // 向客户端发送更新信息
    ws.send({
      type: 'update',
      updates: [
        {
          type: 'js-update',
          timestamp: Date.now(),
          path: '/' + getShortName(file, root),
          acceptedPath: '/' + getShortName(file, root),
        },
      ],
    });
  });
}
