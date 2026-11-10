import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { activityGameAnswerBodySchema, UserRole, type ActivityGameAnswerBody } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import type { RequestUser } from '../../../core/audit/request-user';
import { AppZodValidationPipe } from '../../../core/http/zod-validation.pipe';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import { ZodRequestBody } from '../dto/zod-request-body';
import {
  ActivityGameAnswerResultDto,
  ActivityGameStepDto,
  ChallengeAnswerBodyDto,
  ChallengeAnswerResultDto,
  ChallengeStepDto,
  SimulatorUseBodyDto,
  SimulatorUseResultDto,
  TeacherActivityParamsDto,
  TeacherModuleDto,
  TeacherModuleParamsDto,
  TeacherRouteDto,
  ViewMarkDto,
  WheelStampBodyDto,
  WheelStampResultDto,
} from '../dto/training.dto';
import { TrainingGamesService } from '../games/training-games.service';
import { TrainingProgressService } from '../progress/training-progress.service';
import { TrainingRouteService } from './training-route.service';

// Prefijo propio (como `/me/assignments`): separa el rol mínimo del de coordinación. Sin
// `@Audited`: sus hitos los escribe el servicio dentro de su transacción (R30).
@Controller('me/training')
@RequireRole(UserRole.Teacher)
export class MyTrainingController {
  constructor(
    private readonly route: TrainingRouteService,
    private readonly progress: TrainingProgressService,
    private readonly games: TrainingGamesService,
  ) {}

  @Get('route')
  @ZodResponse({ status: 200, type: TeacherRouteDto })
  routeOf(@CurrentUser() user: RequestUser) {
    return this.route.route(user);
  }

  @Get('modules/:moduleId')
  @ZodResponse({ status: 200, type: TeacherModuleDto })
  module(@CurrentUser() user: RequestUser, @Param() { moduleId }: TeacherModuleParamsDto) {
    return this.route.getModule(user, moduleId);
  }

  // ---------- Marcas ----------

  @Post('modules/:moduleId/video-viewed')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ViewMarkDto })
  videoViewed(@CurrentUser() user: RequestUser, @Param() { moduleId }: TeacherModuleParamsDto) {
    return this.progress.markVideo(user, moduleId);
  }

  @Post('modules/:moduleId/presentation-viewed')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ViewMarkDto })
  presentationViewed(
    @CurrentUser() user: RequestUser,
    @Param() { moduleId }: TeacherModuleParamsDto,
  ) {
    return this.progress.markPresentation(user, moduleId);
  }

  // ---------- Desafío GNS ----------

  @Post('modules/:moduleId/challenge')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ChallengeStepDto })
  startChallenge(@CurrentUser() user: RequestUser, @Param() { moduleId }: TeacherModuleParamsDto) {
    return this.games.startChallenge(user, moduleId);
  }

  @Post('modules/:moduleId/challenge/answer')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ChallengeAnswerResultDto })
  answerChallenge(
    @CurrentUser() user: RequestUser,
    @Param() { moduleId }: TeacherModuleParamsDto,
    @Body() body: ChallengeAnswerBodyDto,
  ) {
    return this.games.answerChallenge(user, moduleId, body);
  }

  @Post('modules/:moduleId/challenge/next')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ChallengeStepDto })
  nextChallenge(@CurrentUser() user: RequestUser, @Param() { moduleId }: TeacherModuleParamsDto) {
    return this.games.nextChallenge(user, moduleId);
  }

  // ---------- Actividades ----------

  @Post('activities/:activityId/stamps')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: WheelStampResultDto })
  stamp(
    @CurrentUser() user: RequestUser,
    @Param() { activityId }: TeacherActivityParamsDto,
    @Body() body: WheelStampBodyDto,
  ) {
    return this.progress.stamp(user, activityId, body);
  }

  @Post('activities/:activityId/use')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: SimulatorUseResultDto })
  use(
    @CurrentUser() user: RequestUser,
    @Param() { activityId }: TeacherActivityParamsDto,
    // Cuerpo vacío estricto: ningún valor de las entradas del simulador llega al servidor.
    @Body() body: SimulatorUseBodyDto,
  ) {
    void body;
    return this.progress.useSimulator(user, activityId);
  }

  @Post('activities/:activityId/game')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ActivityGameStepDto })
  startGame(@CurrentUser() user: RequestUser, @Param() { activityId }: TeacherActivityParamsDto) {
    return this.games.startActivityGame(user, activityId);
  }

  @Post('activities/:activityId/game/answer')
  @ZodRequestBody(activityGameAnswerBodySchema)
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ActivityGameAnswerResultDto })
  answerGame(
    @CurrentUser() user: RequestUser,
    @Param() { activityId }: TeacherActivityParamsDto,
    @Body(new AppZodValidationPipe(activityGameAnswerBodySchema)) body: ActivityGameAnswerBody,
  ) {
    return this.games.answerActivityGame(user, activityId, body);
  }

  @Post('activities/:activityId/game/next')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ActivityGameStepDto })
  nextGame(@CurrentUser() user: RequestUser, @Param() { activityId }: TeacherActivityParamsDto) {
    return this.games.nextActivityGame(user, activityId);
  }
}
