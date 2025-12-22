import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { DocumentationService, CoverageResult } from './documentation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import {
  CreateDocumentationDto,
  UpdateDocumentationDto,
  DocumentationFilterDto,
} from './dto/documentation.dto';
import { DocumentationDocument } from '../../schemas/documentation.schema';

@ApiTags('docs')
@Controller('docs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentationController {
  constructor(private readonly documentationService: DocumentationService) {}

  // ==================== Static Routes (must be before :id routes) ====================

  /**
   * GET /search - Search documentation using text search
   * Requirements: 2.5
   */
  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search documentation entries' })
  @ApiResponse({
    status: 200,
    description: 'Returns matching documentation entries sorted by relevance',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query string' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by document type' })
  @ApiQuery({ name: 'tag', required: false, description: 'Filter by tag' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of results' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip' })
  async search(
    @Query('q') query: string,
    @Query() filter: DocumentationFilterDto,
  ): Promise<DocumentationDocument[]> {
    return this.documentationService.search(query, filter);
  }

  /**
   * GET /stats - Get aggregate statistics
   * Requirements: 4.6
   */
  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Get documentation statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns aggregate statistics for documentation',
  })
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byTag: Record<string, number>;
    pinnedCount: number;
  }> {
    return this.documentationService.getStats();
  }

  /**
   * GET /coverage/:target - Get coverage information for a target
   * Requirements: 3.3, 4.6
   */
  @Get('coverage/:target')
  @Public()
  @ApiOperation({ summary: 'Get documentation coverage for a specific target' })
  @ApiResponse({
    status: 200,
    description: 'Returns coverage information with relevance scores',
  })
  @ApiParam({ name: 'target', description: 'Target name to get coverage for' })
  async getCoverage(@Param('target') target: string): Promise<CoverageResult> {
    return this.documentationService.getCoverageForTarget(target);
  }

  // ==================== CRUD Endpoints ====================

  /**
   * GET / - Find all documentation entries with filter query params
   * Requirements: 4.1
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all documentation entries with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of documentation entries',
  })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by document type' })
  @ApiQuery({ name: 'tag', required: false, description: 'Filter by tag' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'target', required: false, description: 'Filter by target' })
  @ApiQuery({ name: 'technology', required: false, description: 'Filter by technology' })
  @ApiQuery({ name: 'isPinned', required: false, description: 'Filter by pinned status' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of results' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip' })
  @ApiQuery({ name: 'sort', required: false, description: 'Sort field and direction' })
  async findAll(
    @Query() filter: DocumentationFilterDto,
  ): Promise<DocumentationDocument[]> {
    return this.documentationService.findAll(filter);
  }

  /**
   * POST / - Create a new documentation entry
   * Requirements: 4.2
   */
  @Post()
  @ApiOperation({ summary: 'Create a new documentation entry' })
  @ApiResponse({
    status: 201,
    description: 'Documentation entry created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async create(
    @Body() createDto: CreateDocumentationDto,
    @Request() req: any,
  ): Promise<DocumentationDocument> {
    const userId = req.user?.sub;
    return this.documentationService.create(createDto, userId);
  }

  /**
   * GET /:id - Find one documentation entry by ID
   * Requirements: 4.3
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get documentation entry by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the documentation entry',
  })
  @ApiResponse({
    status: 404,
    description: 'Documentation not found',
  })
  @ApiParam({ name: 'id', description: 'Documentation ID' })
  async findOne(@Param('id') id: string): Promise<DocumentationDocument> {
    return this.documentationService.findById(id, true); // Increment view count
  }

  /**
   * PUT /:id - Update a documentation entry
   * Requirements: 4.4
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a documentation entry' })
  @ApiResponse({
    status: 200,
    description: 'Documentation entry updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Documentation not found',
  })
  @ApiParam({ name: 'id', description: 'Documentation ID' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateDocumentationDto,
    @Request() req: any,
  ): Promise<DocumentationDocument> {
    const userId = req.user?.sub;
    return this.documentationService.update(id, updateDto, userId);
  }

  /**
   * DELETE /:id - Delete a documentation entry
   * Requirements: 4.5
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a documentation entry' })
  @ApiResponse({
    status: 204,
    description: 'Documentation entry deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Documentation not found',
  })
  @ApiParam({ name: 'id', description: 'Documentation ID' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.documentationService.delete(id);
  }

  // ==================== Pin Endpoints ====================

  /**
   * POST /:id/pin - Pin a documentation entry
   * Requirements: 5.1
   */
  @Post(':id/pin')
  @ApiOperation({ summary: 'Pin a documentation entry' })
  @ApiResponse({
    status: 200,
    description: 'Documentation entry pinned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Documentation not found',
  })
  @ApiParam({ name: 'id', description: 'Documentation ID' })
  async pin(@Param('id') id: string): Promise<DocumentationDocument> {
    return this.documentationService.pin(id);
  }

  /**
   * DELETE /:id/pin - Unpin a documentation entry
   * Requirements: 5.2
   */
  @Delete(':id/pin')
  @ApiOperation({ summary: 'Unpin a documentation entry' })
  @ApiResponse({
    status: 200,
    description: 'Documentation entry unpinned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Documentation not found',
  })
  @ApiParam({ name: 'id', description: 'Documentation ID' })
  async unpin(@Param('id') id: string): Promise<DocumentationDocument> {
    return this.documentationService.unpin(id);
  }

  // ==================== Related Docs Endpoints ====================

  /**
   * POST /:id/related/:relatedId - Add a related document
   * Requirements: 6.1
   */
  @Post(':id/related/:relatedId')
  @ApiOperation({ summary: 'Add a related document to a documentation entry' })
  @ApiResponse({
    status: 200,
    description: 'Related document added successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Documentation or related document not found',
  })
  @ApiParam({ name: 'id', description: 'Documentation ID' })
  @ApiParam({ name: 'relatedId', description: 'Related documentation ID to add' })
  async addRelated(
    @Param('id') id: string,
    @Param('relatedId') relatedId: string,
  ): Promise<DocumentationDocument> {
    return this.documentationService.addRelatedDoc(id, relatedId);
  }

  /**
   * DELETE /:id/related/:relatedId - Remove a related document
   * Requirements: 6.1
   */
  @Delete(':id/related/:relatedId')
  @ApiOperation({ summary: 'Remove a related document from a documentation entry' })
  @ApiResponse({
    status: 200,
    description: 'Related document removed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Documentation not found',
  })
  @ApiParam({ name: 'id', description: 'Documentation ID' })
  @ApiParam({ name: 'relatedId', description: 'Related documentation ID to remove' })
  async removeRelated(
    @Param('id') id: string,
    @Param('relatedId') relatedId: string,
  ): Promise<DocumentationDocument> {
    return this.documentationService.removeRelatedDoc(id, relatedId);
  }
}
