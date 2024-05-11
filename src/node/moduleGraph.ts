import { PartialResolvedId, TransformResult } from 'rollup';

export class ModuleNode {
  // 资源访问：url
  url: string;
  // 资源访问的绝对路径
  id: string | null = null;
  importers = new Set<ModuleNode>();
  importedModules = new Set<ModuleNode>();
  transformResult: TransformResult | null = null;
  lastHMRTimestamp = 0;
  constructor(url: string) {
    this.url = url;
  }
}

export class ModuleGraph {
  // 资源url到 ModuleNode的映射表
  urlToModuleMap = new Map<string, ModuleNode>();
  // 资源绝对路径到 ModuleNode的映射表
  idToModuleMap = new Map<string, ModuleNode>();

  constructor(
    private resolveId: (id: string) => Promise<PartialResolvedId | null>
  ) {}

  getModuleById(id: string): ModuleNode | undefined {
    return this.idToModuleMap.get(id);
  }

  async getModuleByUrl(rawUrl: string): Promise<ModuleNode | undefined> {
    const { url } = await this._resolve(rawUrl);
    return this.urlToModuleMap.get(url);
  }

  async ensureEntryFromUrl(rawUrl: string): Promise<ModuleNode> {
    const { url, resolvedId } = await this._resolve(rawUrl);
    // 首先检查缓存
    if (this.urlToModuleMap.has(url)) {
      return this.urlToModuleMap.get(url)!;
    }
    // 若无缓存，更新 urlToModuleMap 和 idToModuleMap
    const mod = new ModuleNode(url);
    mod.id = resolvedId;
    this.urlToModuleMap.set(url, mod);
    this.idToModuleMap.set(resolvedId, mod);
    return mod;
  }

  async updateModuleInfo(
    mod: ModuleNode,
    importedModules: Set<string | ModuleNode>
  ) {
    const prevImports = mod.importedModules;
    for (const curImports of importedModules) {
      const dep =
        typeof curImports === 'string'
          ? await this.ensureEntryFromUrl(curImports)
          : curImports;

      if (dep) {
        mod.importedModules.add(dep);
        dep.importers.add(mod);
      }
    }
    for (const preImport of prevImports) {
      if (!importedModules.has(preImport)) {
        prevImports.delete(preImport);
      }
    }
  }

  // HMR 触发时会执行这个函数
  async invalidateModule(file: string) {
    const mod = this.idToModuleMap.get(file);
    if (mod) {
      // 更新时间戳
      mod.lastHMRTimestamp = Date.now();
      mod.transformResult = null;
      mod.importers.forEach((importer) => {
        this.invalidateModule(importer.id!);
      });
    }
  }

  private async _resolve(
    url: string
  ): Promise<{ url: string; resolvedId: string }> {
    const resolved = await this.resolveId(url);
    const resolvedId = resolved?.id || url;
    return { url, resolvedId };
  }
}
