import { CurrentUser, type AuthenticatedUser } from '@libs/auth';
import { Body, Controller, Post } from '@nestjs/common';
import { SaveNoteDto, SaveNoteResponseDto } from './note.entity';
import { NotesService } from './notes.service';

@Controller('api/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  async saveNote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveNoteDto,
  ): Promise<SaveNoteResponseDto> {
    const note = await this.notesService.saveNote(user.id, dto);
    return new SaveNoteResponseDto(note);
  }
}
