import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { HexStrikeService } from './hexstrike.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { AnalyzeTargetDto } from './dto/analyze-target.dto';
import { ExecuteToolDto } from './dto/execute-tool.dto';
import { StartWorkflowDto } from './dto/workflow.dto';
import { UpdateConfigDto } from './dto/config.dto';

@ApiTags('hexstrike')
@Controller('hexstrike')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HexStrikeController {
  constructor(private readonly hexstrikeService: HexStrikeService) {}

  @Get('health')
  @Public() // Health check is public for monitoring/health probes
  @ApiOperation({ summary: 'Get HexStrike AI server health status' })
  async getHealth() {
    return this.hexstrikeService.getHealth();
  }

  @Post('analyze-target')
  @ApiOperation({ summary: 'Analyze a target and get comprehensive profile' })
  @ApiBody({ type: AnalyzeTargetDto })
  async analyzeTarget(@Body() dto: AnalyzeTargetDto) {
    return this.hexstrikeService.analyzeTarget(dto.target);
  }

  @Get('tools')
  @ApiOperation({ summary: 'Get list of available security tools' })
  async getTools() {
    return this.hexstrikeService.getTools();
  }

  @Post('tools/:tool/execute')
  @ApiOperation({ summary: 'Execute a specific security tool' })
  @ApiParam({ name: 'tool', description: 'Tool name to execute' })
  @ApiBody({ type: ExecuteToolDto })
  async executeTool(
    @Param('tool') tool: string,
    @Body() dto: ExecuteToolDto,
  ) {
    return this.hexstrikeService.executeTool(tool, dto.target, dto.parameters);
  }

  @Get('workflows')
  @ApiOperation({ summary: 'Get list of available AI workflows' })
  async getWorkflows() {
    return this.hexstrikeService.getWorkflows();
  }

  @Post('workflows/:type/start')
  @ApiOperation({ summary: 'Start an AI workflow' })
  @ApiParam({ name: 'type', description: 'Workflow type to start' })
  @ApiBody({ type: StartWorkflowDto })
  async startWorkflow(
    @Param('type') type: string,
    @Body() dto: StartWorkflowDto,
  ) {
    return this.hexstrikeService.startWorkflow(type, dto.target, dto.options);
  }

  @Get('processes')
  @ApiOperation({ summary: 'Get list of active processes' })
  async getProcesses() {
    return this.hexstrikeService.getProcesses();
  }

  @Get('processes/:pid')
  @ApiOperation({ summary: 'Get process status by PID' })
  @ApiParam({ name: 'pid', description: 'Process ID' })
  async getProcessStatus(@Param('pid', ParseIntPipe) pid: number) {
    return this.hexstrikeService.getProcessStatus(pid);
  }

  @Post('processes/:pid/terminate')
  @ApiOperation({ summary: 'Terminate a running process' })
  @ApiParam({ name: 'pid', description: 'Process ID to terminate' })
  async terminateProcess(@Param('pid', ParseIntPipe) pid: number) {
    return this.hexstrikeService.terminateProcess(pid);
  }

  @Get('config')
  @ApiOperation({ summary: 'Get HexStrike AI configuration' })
  async getConfig() {
    return this.hexstrikeService.getConfig();
  }

  @Put('config')
  @ApiOperation({ summary: 'Update HexStrike AI configuration' })
  @ApiBody({ type: UpdateConfigDto })
  async updateConfig(@Body() dto: UpdateConfigDto) {
    return this.hexstrikeService.updateConfig(dto);
  }
}
