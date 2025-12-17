import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewerCreationService } from './reviewer-creation.service';
import { UsersService } from './users.service';

class CreateReviewerRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

class ConfirmReviewerDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

@Controller('admin/reviewers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReviewerManagementController {
  private readonly logger = new Logger(ReviewerManagementController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly reviewerCreationService: ReviewerCreationService,
  ) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  async requestReviewerCreation(
    @Request() req,
    @Body() dto: CreateReviewerRequestDto,
  ) {
    const adminUserId = req.user?.sub;

    if (!adminUserId) {
      throw new Error('User ID no encontrado en token JWT');
    }

    this.logger.log(`Admin ${adminUserId} solicita crear reviewer: ${dto.email}`);

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new Error(`Ya existe un usuario con el email ${dto.email}`);
    }

    const result = await this.reviewerCreationService.createVerificationRequest(
      adminUserId,
      dto.email,
      dto.fullName,
      dto.password,
    );

    return {
      success: true,
      message: 'Código de verificación enviado. Revisa tu email.',
      requestId: result.id,
    };
  }

  @Post('confirm')
  @HttpCode(HttpStatus.CREATED)
  async confirmReviewerCreation(
    @Request() req,
    @Body() dto: ConfirmReviewerDto,
  ) {
    const adminUserId = req.user?.sub;

    if (!adminUserId) {
      throw new Error('User ID no encontrado en token JWT');
    }

    this.logger.log(`Admin ${adminUserId} confirma creación de reviewer con código`);

    const result = await this.reviewerCreationService.confirmAndCreateReviewer(
      adminUserId,
      dto.code,
    );

    return {
      success: true,
      message: `Revisor ${result.user.email} creado exitosamente. Se ha enviado un email con las credenciales.`,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
      },
    };
  }
}
