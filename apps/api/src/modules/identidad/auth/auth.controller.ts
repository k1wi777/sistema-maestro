import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { SessionProvider, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import type { RequestUser } from '../../../core/audit/request-user';
import type { Env } from '../../../core/config/env.validation';
import { AllowWithoutConsent, Public, RequireRole } from './access.decorators';
import { AuthService, type SessionResult } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto, CurrentUserDto, LoginDto } from './dto/auth.dto';
import { LoginThrottled } from './login-throttle';
import {
  clearSessionCookies,
  readCookie,
  REFRESH_COOKIE,
  setSessionCookies,
  type CookieRequest,
  type CookieResponse,
  type CookieSettings,
} from './session-cookies';

@Controller('auth')
export class AuthController {
  private readonly cookieSettings: CookieSettings;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSettings = {
      secure: config.get('AUTH_COOKIE_SECURE', { infer: true }),
      accessTtlMinutes: config.get('ACCESS_TOKEN_TTL_MINUTES', { infer: true }),
    };
  }

  /** Público. Las cookies llevan los tokens; el cuerpo, solo el usuario actual. */
  @Post('login')
  @Public()
  @LoginThrottled()
  @HttpCode(200)
  @ZodResponse({ status: 200, type: CurrentUserDto })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: CookieResponse) {
    const result = await this.auth.signIn(SessionProvider.Password, body, body.rememberMe);
    return this.emit(response, result);
  }

  /** Renueva con la cookie de renovación (solo llega a `/auth`); no exige el token de acceso. */
  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ZodResponse({ status: 200, type: CurrentUserDto })
  async refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const result = await this.auth.refresh(readCookie(request, REFRESH_COOKIE));
    if (!result) {
      clearSessionCookies(response, this.cookieSettings.secure);
      throw new UnauthorizedException('La sesión ya no es válida');
    }
    return this.emit(response, result);
  }

  /** Revoca la sesión actual y borra las cookies, también si la sesión ya no era válida. */
  @Post('logout')
  @Public()
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Sesión cerrada' })
  async logout(
    @Req() request: CookieRequest & { user?: RequestUser },
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.auth.logout(readCookie(request, REFRESH_COOKIE), request.user?.sessionId);
    clearSessionCookies(response, this.cookieSettings.secure);
  }

  @Get('me')
  @RequireRole(UserRole.Teacher)
  @AllowWithoutConsent()
  @ZodResponse({ status: 200, type: CurrentUserDto })
  me(@CurrentUser() user: RequestUser) {
    return this.auth.profile(user.id);
  }

  @Put('password')
  @RequireRole(UserRole.Teacher)
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Contraseña cambiada; las demás sesiones se cerraron' })
  async changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    await this.auth.changePassword(user, body.currentPassword, body.newPassword);
  }

  private emit(response: CookieResponse, { issued, user }: SessionResult) {
    setSessionCookies(response, issued, this.cookieSettings);
    return user;
  }
}
