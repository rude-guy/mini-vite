// 具有中间件机制的轻量级 Node.js 框架 既可以单独作为服务器，也可以接入到任何具有中间件机制的框架中，如 Koa、Express
import connect from 'connect';
//用来在命令行显示不同颜色文本的工具
import { blue, green } from 'picocolors';
import { optimizer } from '../optimizer';
import {
  PluginContainer,
  createPluginContainer,
  resolvePlugins,
} from '../pluginContainer';
import { Plugin } from '../plugin';
import { middlewareIndexHtml } from './middlewares/indexHtml';
import { transformMiddleware } from './middlewares/transform';
import { staticMiddleware } from './middlewares/static';

export interface ServerContext {
  root: string;
  pluginContainer: PluginContainer;
  app: connect.Server;
  plugins: Plugin[];
}

export async function startDevServer() {
  const app = connect();
  const root = process.cwd();
  const startTime = Date.now();
  const plugins = resolvePlugins();
  const pluginContainer = createPluginContainer(plugins);

  const serverContext: ServerContext = {
    root,
    pluginContainer,
    app,
    plugins,
  };

  // 执行configureServer钩子
  for (const plugin of plugins) {
    if (typeof plugin.configureServer === 'function') {
      await plugin.configureServer(serverContext);
    }
  }

  app.use(middlewareIndexHtml(serverContext));
  app.use(transformMiddleware(serverContext));
  app.use(staticMiddleware(serverContext.root));

  app.listen(3000, async () => {
    await optimizer(root);

    console.log(
      green('🚀 No-Bundle 服务已经成功启动!'),
      `耗时: ${Date.now() - startTime}ms`
    );
    console.log(`> 本地访问路径: ${blue('http://localhost:3000')}`);
  });
}
