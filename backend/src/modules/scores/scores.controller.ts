import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ScoresService } from './scores.service';
import { ScoreTargetType } from '../../schemas/score.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Scores')
@Controller('api/scores')
export class ScoresController {
  constructor(private scoresService: ScoresService) {}

  @Post('calculate/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Recalculate all scores' })
  @ApiResponse({ status: 200, description: 'Scores calculated' })
  async calculateAll() {
    const result = await this.scoresService.calculateAllScores();
    return {
      message: 'Scores calculated successfully',
      ...result,
    };
  }

  @Post('calculate/program/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate score for a program' })
  @ApiResponse({ status: 200, description: 'Score calculated' })
  async calculateProgramScore(@Param('id') id: string) {
    return this.scoresService.calculateProgramScore(id);
  }

  @Post('calculate/domain/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate score for a domain' })
  @ApiResponse({ status: 200, description: 'Score calculated' })
  async calculateDomainScore(@Param('id') id: string) {
    return this.scoresService.calculateDomainScore(id);
  }

  @Get('program/:id')
  @Public()
  @ApiOperation({ summary: 'Get score for a program' })
  @ApiResponse({ status: 200, description: 'Program score' })
  async getProgramScore(@Param('id') id: string) {
    return this.scoresService.getScore(id, ScoreTargetType.PROGRAM);
  }

  @Get('domain/:id')
  @Public()
  @ApiOperation({ summary: 'Get score for a domain' })
  @ApiResponse({ status: 200, description: 'Domain score' })
  async getDomainScore(@Param('id') id: string) {
    return this.scoresService.getScore(id, ScoreTargetType.DOMAIN);
  }

  @Get('top/programs')
  @Public()
  @ApiOperation({ summary: 'Get top scored programs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['totalScore', 'pentestScore', 'exposureScore', 'priorityScore'] })
  @ApiResponse({ status: 200, description: 'Top programs by score' })
  async getTopPrograms(
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.scoresService.getTopScores(
      ScoreTargetType.PROGRAM,
      limit ? parseInt(limit, 10) : 20,
      sortBy || 'totalScore',
    );
  }

  @Get('top/domains')
  @Public()
  @ApiOperation({ summary: 'Get top scored domains' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['totalScore', 'pentestScore', 'exposureScore', 'priorityScore'] })
  @ApiResponse({ status: 200, description: 'Top domains by score' })
  async getTopDomains(
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.scoresService.getTopScores(
      ScoreTargetType.DOMAIN,
      limit ? parseInt(limit, 10) : 20,
      sortBy || 'totalScore',
    );
  }

  @Get('compare')
  @Public()
  @ApiOperation({ summary: 'Compare scores between targets' })
  @ApiQuery({ name: 'ids', required: true, description: 'Comma-separated target IDs' })
  @ApiQuery({ name: 'type', required: true, enum: ['program', 'domain'] })
  @ApiResponse({ status: 200, description: 'Comparison data' })
  async compare(
    @Query('ids') ids: string,
    @Query('type') type: string,
  ) {
    const targetIds = ids.split(',').map(id => id.trim());
    const targetType = type === 'program' ? ScoreTargetType.PROGRAM : ScoreTargetType.DOMAIN;
    return this.scoresService.compareScores(targetIds, targetType);
  }

  @Get('history/:id')
  @Public()
  @ApiOperation({ summary: 'Get score history for a target' })
  @ApiQuery({ name: 'type', required: true, enum: ['program', 'domain'] })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Score history' })
  async getHistory(
    @Param('id') id: string,
    @Query('type') type: string,
    @Query('days') days?: string,
  ) {
    const targetType = type === 'program' ? ScoreTargetType.PROGRAM : ScoreTargetType.DOMAIN;
    return this.scoresService.getScoreHistory(
      id,
      targetType,
      days ? parseInt(days, 10) : 30,
    );
  }
}

