import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tool, ToolSchema } from '../../schemas/tool.schema';
import { ToolExecution, ToolExecutionSchema } from '../../schemas/tool-execution.schema';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { ValidationService } from './validation.service';
import { ExecutorService } from './executor.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tool.name, schema: ToolSchema },
      { name: ToolExecution.name, schema: ToolExecutionSchema },
    ]),
  ],
  controllers: [ToolsController],
  providers: [ToolsService, ValidationService, ExecutorService],
  exports: [ToolsService],
})
export class ToolsModule {}
