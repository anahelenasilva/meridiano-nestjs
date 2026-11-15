import { Body, Controller, HttpCode, Post } from '@nestjs/common';
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
import { AskRequestDto, AskResponseDto } from './dto/ask.dto';

@Controller('api/ask')
@ApiAuthErrorResponse()
export class AskController {
  constructor(private readonly askService: AskService) {}

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
