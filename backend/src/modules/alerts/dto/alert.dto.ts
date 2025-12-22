import { IsString, IsEnum, IsArray, IsBoolean, IsOptional, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertConditionType, AlertConditionOperator, AlertSeverity, AlertChannel } from '../../../schemas/alert-rule.schema';

export class AlertConditionDto {
  @ApiProperty({ enum: AlertConditionType })
  @IsEnum(AlertConditionType)
  type: AlertConditionType;

  @ApiProperty({ enum: AlertConditionOperator })
  @IsEnum(AlertConditionOperator)
  operator: AlertConditionOperator;

  @ApiProperty({ description: 'Value to match against' })
  value: any;

  @ApiPropertyOptional({ description: 'Previous value for change detection' })
  @IsOptional()
  previousValue?: any;
}

export class CreateAlertRuleDto {
  @ApiProperty({ description: 'Name of the alert rule' })
  @IsString()
  name: string;

  @ApiProperty({ type: AlertConditionDto })
  @ValidateNested()
  @Type(() => AlertConditionDto)
  @IsObject()
  condition: AlertConditionDto;

  @ApiPropertyOptional({ enum: AlertSeverity, default: AlertSeverity.INFO })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiPropertyOptional({ type: [String], enum: AlertChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(AlertChannel, { each: true })
  channels?: AlertChannel[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Program ID to scope the rule' })
  @IsOptional()
  @IsString()
  programId?: string;
}

export class UpdateAlertRuleDto {
  @ApiPropertyOptional({ description: 'Name of the alert rule' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: AlertConditionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AlertConditionDto)
  @IsObject()
  condition?: AlertConditionDto;

  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiPropertyOptional({ type: [String], enum: AlertChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(AlertChannel, { each: true })
  channels?: AlertChannel[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Program ID to scope the rule' })
  @IsOptional()
  @IsString()
  programId?: string;
}
