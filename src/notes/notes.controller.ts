import { CurrentUser, type AuthenticatedUser } from '@libs/auth';
import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { SaveNoteDto, SaveNoteResponseDto } from './note.entity';
import { NOTES_SERVICE, type NotesWriter } from './notes.tokens';

@Controller('api/notes')
export class NotesController {
  constructor(
    @Inject(NOTES_SERVICE)
    private readonly notesService: NotesWriter,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Save an authenticated user note' })
  @ApiCreatedResponse({ type: SaveNoteResponseDto })
  async saveNote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveNoteDto,
  ): Promise<SaveNoteResponseDto> {
    const note = await this.notesService.saveNote(user.id, dto);
    return new SaveNoteResponseDto(note);
  }
}
