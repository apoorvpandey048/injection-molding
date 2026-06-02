/// <reference types="vite/client" />

// three ships its own types but does not include a .d.ts for ColladaLoader, so
// declare the minimal surface the workbench relies on.
declare module "three/examples/jsm/loaders/ColladaLoader.js" {
  import { Loader, LoadingManager, Group } from "three";
  export interface Collada {
    scene: Group;
    animations: unknown[];
    library: unknown;
  }
  export class ColladaLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (collada: Collada) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: unknown) => void,
    ): void;
    parse(text: string, path: string): Collada;
  }
}
