import BaseProvider from "./base_provider";
import GuwenwenProvider from "./guwenwen_provider";
import MingyanProvider from "./mingyan_provider";
import GithubDatasetProvider from "./github_dataset_provider";
import WikiquoteProvider from "./wikiquote_provider";

const registry: Map<string, () => BaseProvider> = new Map();

registry.set("guwenwen", () => new GuwenwenProvider());
registry.set("mingyan", () => new MingyanProvider());
registry.set("github_dataset", () => new GithubDatasetProvider());
registry.set("wikiquote", () => new WikiquoteProvider());

export function getProvider(code: string): BaseProvider | null {
  const factory = registry.get(code);
  if (!factory) return null;
  return factory();
}

export function listProviders(): string[] {
  return Array.from(registry.keys());
}

export function getAllProviders(): BaseProvider[] {
  return Array.from(registry.values()).map((factory) => factory());
}

export function registerProvider(code: string, factory: () => BaseProvider): void {
  registry.set(code, factory);
}

export default { getProvider, listProviders, getAllProviders, registerProvider };
