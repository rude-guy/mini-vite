import { readFile } from 'fs-extra';
import { Plugin } from '../plugin';
import { CLIENT_PUBLIC_PATH } from '../constants';
import { getShortName } from '../util';
import { ServerContext } from '../server';

export function cssPlugin(): Plugin {
  let serverContext: ServerContext;
  return {
    name: 'm-vite:css',
    configureServer(s) {
      serverContext = s;
    },
    load(id) {
      if (id.endsWith('.css')) {
        return readFile(id, 'utf-8');
      }
    },
    transform(code, id) {
      if (id.endsWith('.css')) {
        // 包装成js模块
        const jsContent = `
          import { createHotContext as __vite__createHotContext } from "${CLIENT_PUBLIC_PATH}";
          import.meta.hot = __vite__createHotContext("/${getShortName(id, serverContext.root)}");
          import { updateStyle, removeStyle } from "${CLIENT_PUBLIC_PATH}" 
          const id = '${id}';
          const css = \`${code.replace(/\n/g, '')}\`;
          updateStyle(id, css);
          import.meta.hot.accept();
          export default css;
          if (import.meta.hot) import.meta.hot.prune(() => removeStyle(id))
        `.trim();
        return {
          code: jsContent,
        };
      }
      return null;
    },
  };
}
