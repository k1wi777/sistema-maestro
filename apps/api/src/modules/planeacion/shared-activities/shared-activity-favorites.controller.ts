import { Controller, Delete, HttpCode, Param, Put } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import { SHARED_ACTIVITY_FAVORITES_AUDIT } from './shared-activity.audit-snapshot';
import { SharedActivitiesService } from './shared-activities.service';

/**
 * Favoritos del docente en sesión. `PUT` y `DELETE` dejan la actividad en el estado pedido
 * aunque ya estuviera en él (204 en la repetición); 404 si la actividad no existe.
 */
@Controller('shared-activities/:id/favorite')
@RequireRole(UserRole.Teacher)
export class SharedActivityFavoritesController {
  constructor(private readonly activities: SharedActivitiesService) {}

  @Put()
  @HttpCode(204)
  @Audited({ ...SHARED_ACTIVITY_FAVORITES_AUDIT, action: 'Marcó una actividad como favorita' })
  favorite(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.activities.favorite(user, id);
  }

  @Delete()
  @HttpCode(204)
  @Audited({ ...SHARED_ACTIVITY_FAVORITES_AUDIT, action: 'Desmarcó una actividad favorita' })
  unfavorite(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.activities.unfavorite(user, id);
  }
}
