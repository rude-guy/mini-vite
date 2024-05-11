console.log('[vite] connecting...');

interface Update {
  type: 'js-update';
  path: string;
  acceptedPath: string;
  timestamp: number;
}

// 1. 创建客户端 Websocket 实例
//  其中的 __HMR_PORT__ 之后会被 no-bundle 服务编译成具体的端口号
const socket = new WebSocket('ws://localhost:__HMR_PORT__', 'vite-hmr');

// 2. 接收服务端的更新信息
socket.addEventListener('message', ({ data }) => {
  handleMessage(JSON.parse(data)).catch(console.error);
});

async function handleMessage(payload: any) {
  switch (payload.type) {
    case 'connected':
      console.log(`[vite] connected.`);
      // 心跳检测
      setInterval(() => {
        socket.send('ping');
      }, 3000);
      break;
    case 'update':
      // 进行具体的模块更新
      payload.updates.forEach((update: Update) => {
        if (update.type === 'js-update') {
          // 具体的更新逻辑，后续来开发
          fetchUpdate(update);
        }
      });
      break;
  }
}

interface HotModule {
  id: string;
  callbacks: HotCallback[];
}

interface HotCallback {
  deps: string[];
  fn: (modules: Object[]) => void;
}

// HMR 模块表
const hotModulesMap = new Map<string, HotModule>();
// 不在生效的模块表
const pruneMap = new Map<string, (data: any) => Promise<void> | void>();

export const createHotContext = (ownerPath: string) => {
  const mod = hotModulesMap.get(ownerPath);
  if (mod) {
    mod.callbacks = [];
  }

  function acceptDeps(deps: string[], callback: any) {
    const mod: HotModule = hotModulesMap.get(ownerPath) || {
      id: ownerPath,
      callbacks: [],
    };
    // callbacks 属性存放 accept 的依赖，依赖改动后对应的回调逻辑
    mod.callbacks.push({
      deps,
      fn: callback,
    });
    hotModulesMap.set(ownerPath, mod);
  }

  return {
    accept(deps: any) {
      // 这里仅考虑接受自身模块更新的情况
      // import.meta.hot.accept()
      if (typeof deps === 'function' || !deps) {
        acceptDeps([ownerPath], ([mod]: HotModule[]) => deps && deps(mod));
      }
    },
    // 模块不再生效的回调
    // import.meta.hot.prune(() => {})
    prune(cb: (data: any) => any) {
      pruneMap.set(ownerPath, cb);
    },
  };
};

async function fetchUpdate({ path, timestamp }: Update) {
  const mod = hotModulesMap.get(path);
  if (!mod) {
    return;
  }

  const moduleMap = new Map();
  const modulesToUpdate = new Set<string>();
  modulesToUpdate.add(path);

  await Promise.all(
    Array.from(modulesToUpdate).map(async (dep) => {
      const [path, query] = dep.split('?');
      try {
        // 通过动态 import 拉取最新模块
        const newMod = await import(
          path + `?t=${timestamp}${query ? `&${query}` : ''}`
        );
        moduleMap.set(dep, newMod);
      } catch (e) {}
    })
  );

  return () => {
    // 拉取最新模块后执行更新回调
    for (const { deps, fn } of mod.callbacks) {
      fn(deps.map((dep: any) => moduleMap.get(dep)));
    }
    console.log(`[vite] hot updated: ${path}`);
  };
}

const sheetsMap = new Map<string, HTMLStyleElement>();
export async function updateStyle(id: string, content: string) {
  let style = sheetsMap.get(id);
  if (!style) {
    // 添加 style 标签
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.innerHTML = content;
    document.head.appendChild(style);
  } else {
    style.innerHTML = content;
  }
  sheetsMap.set(id, style);
}

export function removeStyle(id: string) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
  }
  sheetsMap.delete(id);
}
