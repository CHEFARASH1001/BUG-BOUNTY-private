import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WordlistService } from './services/wordlist.service';

class DownloadWordlistDto {
  url: string;
  name: string;
}

@ApiTags('wordlists')
@Controller('wordlists')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WordlistController {
  constructor(private readonly wordlistService: WordlistService) {}

  @Get()
  @ApiOperation({ summary: 'List available wordlists' })
  async getWordlists() {
    const wordlists = await this.wordlistService.getAvailableWordlists();
    return { wordlists };
  }

  @Post('download')
  @ApiOperation({ summary: 'Download a wordlist from a remote URL' })
  @ApiBody({
    description: 'Wordlist download configuration',
    schema: {
      type: 'object',
      required: ['url', 'name'],
      properties: {
        url: { type: 'string', description: 'URL to download the wordlist from' },
        name: { type: 'string', description: 'Name to save the wordlist as' },
      },
    },
  })
  async downloadWordlist(@Body() downloadDto: DownloadWordlistDto) {
    if (!downloadDto.url) {
      throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
    }

    if (!downloadDto.name) {
      throw new HttpException('Name is required', HttpStatus.BAD_REQUEST);
    }

    // Validate URL format
    try {
      new URL(downloadDto.url);
    } catch {
      throw new HttpException('Invalid URL format', HttpStatus.BAD_REQUEST);
    }

    // Validate name (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(downloadDto.name)) {
      throw new HttpException(
        'Name must contain only alphanumeric characters, hyphens, and underscores',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.wordlistService.downloadWordlist(downloadDto.url, downloadDto.name);
    } catch (error) {
      throw new HttpException(
        `Failed to download wordlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':name/stats')
  @ApiOperation({ summary: 'Get wordlist statistics' })
  @ApiParam({ name: 'name', description: 'Wordlist name' })
  async getWordlistStats(@Param('name') name: string) {
    try {
      return await this.wordlistService.getWordlistStats(name);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new HttpException('Wordlist not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        `Failed to get wordlist stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
