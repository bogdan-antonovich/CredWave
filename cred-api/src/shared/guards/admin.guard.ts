import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AppConfigService } from 'src/config/config.service';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly cfg: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = (req.user as { id: string } | undefined)?.id;
    const adminId = this.cfg.get('admin').Id;

    if (Number(userId) !== adminId) throw new ForbiddenException();
    return true;
  }
}
