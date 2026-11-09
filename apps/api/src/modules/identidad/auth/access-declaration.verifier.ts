import { Injectable, type OnApplicationBootstrap, RequestMethod, type Type } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ACCESS_KEY, type AccessRule } from './access.decorators';

export interface RouteAccess {
  method: string;
  path: string;
  /** `public` o el rol requerido, sin importar si lo declaró el método o la clase. */
  access: string;
  /** `Controlador.método`; `null` si la ruta no tiene declaración. */
  handler: string;
  declared: boolean;
}

type Handler = (...args: unknown[]) => unknown;

function pathsOf(value: unknown): string[] {
  const list = Array.isArray(value) ? (value as unknown[]) : [value ?? ''];
  return list.map((item) => (typeof item === 'string' ? item : ''));
}

function joinPath(controllerPath: string, methodPath: string): string {
  const joined = [controllerPath, methodPath]
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter((part) => part !== '')
    .join('/');
  return `/${joined}`;
}

/**
 * Acceso denegado por defecto: al arrancar recorre todos los controladores y, si algún
 * handler de ruta no declara `@Public()` ni `@RequireRole`, lanza un error que los nombra
 * y la API no inicia (tampoco los comandos ni las pruebas que montan `AppModule`).
 */
@Injectable()
export class AccessDeclarationVerifier implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const missing = this.listRoutes()
      .filter((route) => !route.declared)
      .map((route) => route.handler);
    if (missing.length > 0) {
      throw new Error(
        `Endpoints sin declaración de acceso (@Public o @RequireRole):\n${[...new Set(missing)]
          .map((name) => `- ${name}`)
          .join('\n')}`,
      );
    }
  }

  /** Todas las rutas HTTP con su declaración de acceso; la usa la prueba de inventario. */
  listRoutes(): RouteAccess[] {
    const routes: RouteAccess[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const controller = wrapper.metatype as Type | null;
      const prototype = wrapper.instance
        ? (Object.getPrototypeOf(wrapper.instance) as object)
        : null;
      if (!controller || !prototype) {
        continue;
      }
      const controllerPaths = pathsOf(Reflect.getMetadata(PATH_METADATA, controller));
      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = (prototype as Record<string, Handler>)[name];
        if (!handler) {
          continue;
        }
        const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
          RequestMethod | undefined;
        if (requestMethod === undefined) {
          continue;
        }
        const rule = this.reflector.getAllAndOverride<AccessRule | undefined>(ACCESS_KEY, [
          handler,
          controller,
        ]);
        const methodPaths = pathsOf(Reflect.getMetadata(PATH_METADATA, handler));
        for (const controllerPath of controllerPaths) {
          for (const methodPath of methodPaths) {
            routes.push({
              method: RequestMethod[requestMethod],
              path: joinPath(controllerPath, methodPath),
              access: !rule ? 'sin declaración' : rule.kind === 'public' ? 'public' : rule.role,
              handler: `${controller.name}.${name}`,
              declared: rule !== undefined,
            });
          }
        }
      }
    }
    return routes;
  }
}
