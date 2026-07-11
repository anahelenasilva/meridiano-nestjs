import { Body, Controller, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../shared/types/authenticated-request';
import { SaveNoteDto, SaveNoteResponseDto } from './note.entity';
import { NotesService } from './notes.service';

@Controller('api/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  async saveNote(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SaveNoteDto,
  ): Promise<SaveNoteResponseDto> {
    const note = await this.notesService.saveNote(request.user.id, dto);
    return new SaveNoteResponseDto(note);
  }
}
