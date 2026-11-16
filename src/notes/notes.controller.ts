import { Body, Controller, Inject, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { AppendNoteDto, SaveNoteDto, SaveNoteResponseDto } from './note.entity';
import { NOTES_SERVICE, type NotesWriter } from './notes.tokens';

@Controller('api/notes')
@ApiAuthErrorResponse()
export class NotesController {
  constructor(
    @Inject(NOTES_SERVICE)
    private readonly notesService: NotesWriter,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Save an authenticated user note' })
  @ApiCreatedResponse({ type: SaveNoteResponseDto })
  @ApiValidationErrorResponse()
  async saveNote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveNoteDto,
  ): Promise<SaveNoteResponseDto> {
    const note = await this.notesService.saveNote(user.id, dto);
    return new SaveNoteResponseDto(note);
  }

  @Post('append')
  @ApiOperation({
    summary:
      "Append text to the authenticated user's note on a source after a blank line, creating the note when absent",
  })
  @ApiCreatedResponse({ type: SaveNoteResponseDto })
  @ApiValidationErrorResponse()
  @ApiNotFoundResponse({
    description: 'Article or YouTube transcription not found',
  })
  async appendToNote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AppendNoteDto,
  ): Promise<SaveNoteResponseDto> {
    const note = await this.notesService.appendToNote(user.id, dto);
    return new SaveNoteResponseDto(note);
  }
}
