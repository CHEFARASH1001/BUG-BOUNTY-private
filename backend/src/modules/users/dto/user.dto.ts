import { IsString, IsOptional, IsBoolean, IsEmail, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;
}

export class UpdatePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class UpdateApiKeysDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  shodan?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  securityTrails?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  virusTotal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  censys?: {
    id: string;
    secret: string;
  };

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hunter?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  github?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  urlscan?: string;
}

export class UpdateNotificationsDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  email?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  slack?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  discord?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  telegram?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  onNewVuln?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  onScanComplete?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  onNewSubdomain?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  minSeverity?: string;
}

