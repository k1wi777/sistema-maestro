import { Controller, Get, Post, type Type } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { UserRole } from '@gns/shared';
import { Public, RequireRole } from './access.decorators';
import { AccessDeclarationVerifier } from './access-declaration.verifier';

@Controller('declared')
@RequireRole(UserRole.Administrator)
class DeclaredController {
  @Get()
  list(): void {}

  @Get(':id')
  @Public()
  open(): void {}

  helper(): void {}
}

@Controller('mixed')
class MixedController {
  @Post('a')
  @RequireRole(UserRole.Teacher)
  declared(): void {}

  @Get('b')
  forgotten(): void {}

  @Get('c')
  alsoForgotten(): void {}
}

function verifierWith(...controllers: Type[]) {
  return Test.createTestingModule({
    imports: [DiscoveryModule],
    controllers,
    providers: [AccessDeclarationVerifier],
  }).compile();
}

describe('AccessDeclarationVerifier', () => {
  it('refuses to start and names every handler without a declaration', async () => {
    const module = await verifierWith(DeclaredController, MixedController);

    await expect(module.init()).rejects.toThrow(
      /MixedController\.forgotten[\s\S]*MixedController\.alsoForgotten/,
    );
    await expect(module.init()).rejects.not.toThrow(/DeclaredController/);
  });

  it('starts and lists routes with class and method declarations (method wins)', async () => {
    const module = await verifierWith(DeclaredController);
    await module.init();

    const routes = module
      .get(AccessDeclarationVerifier)
      .listRoutes()
      .map(({ method, path, access }) => ({ method, path, access }));

    expect(routes).toEqual(
      expect.arrayContaining([
        { method: 'GET', path: '/declared', access: UserRole.Administrator },
        { method: 'GET', path: '/declared/:id', access: 'public' },
      ]),
    );
    expect(routes).toHaveLength(2);
  });
});
