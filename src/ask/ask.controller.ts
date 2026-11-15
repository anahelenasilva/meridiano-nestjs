import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import { AskService } from './ask.service';
import { AskModelDto, AskRequestDto, AskResponseDto } from './dto/ask.dto';

@Controller('api/ask')
@ApiAuthErrorResponse()
export class AskController {
  constructor(private readonly askService: AskService) {}

  @Get('models')
  @ApiOperation({ summary: 'List the chat models an Ask can use' })
  @ApiOkResponse({ type: AskModelDto, isArray: true })
  listModels(): AskModelDto[] {
    return this.askService.listModels();
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Answer a question about one Article or YouTube Transcription',
  })
  @ApiOkResponse({ type: AskResponseDto })
  @ApiValidationErrorResponse()
  @ApiNotFoundResponse({ description: 'Source not found' })
  @ApiBadGatewayResponse({ description: 'The chat model failed to answer' })
  ask(@Body() dto: AskRequestDto): Promise<AskResponseDto> {
    return this.askService.ask(dto);
  }
}
