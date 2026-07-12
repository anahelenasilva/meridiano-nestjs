import { JwtAuthGuard } from '@libs/auth';
import { INestApplication, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Note, SaveNoteDto } from '../notes/note.entity';
import type { NotesWriter } from '../notes/notes.tokens';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const notesServiceStub: NotesWriter = {
  saveNote(_userId: string, _input: SaveNoteDto): Promise<Note | null> {
    return Promise.resolve(null);
  },
};

const execFileAsync = promisify(execFile);
const requireFromDist = createRequire(
  join(process.cwd(), 'dist/src/scripts/generateOpenApi.js'),
);

interface CompiledNotesOpenApiModule {
  NotesController: Type<unknown>;
  NOTES_SERVICE: symbol;
}

async function buildCompiledSwaggerMetadata(): Promise<void> {
  await execFileAsync('pnpm', ['exec', 'nest', 'build'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 10,
  });
}

function loadCompiledNotesOpenApiModule(): CompiledNotesOpenApiModule {
  const { NotesController } = requireFromDist(
    '../notes/notes.controller.js',
  ) as {
    NotesController: Type<unknown>;
  };
  const { NOTES_SERVICE } = requireFromDist('../notes/notes.tokens.js') as {
    NOTES_SERVICE: symbol;
  };

  return { NotesController, NOTES_SERVICE };
}

function sortJsonKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }

  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<{ [key: string]: JsonValue }>((sorted, key) => {
        sorted[key] = sortJsonKeys(value[key]);
        return sorted;
      }, {});
  }

  return value;
}

async function createOpenApiApp(
  compiledModule: CompiledNotesOpenApiModule,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [compiledModule.NotesController],
    providers: [
      {
        provide: compiledModule.NOTES_SERVICE,
        useValue: notesServiceStub,
      },
      {
        provide: APP_GUARD,
        useClass: JwtAuthGuard,
      },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function main(): Promise<void> {
  await buildCompiledSwaggerMetadata();

  const compiledModule = loadCompiledNotesOpenApiModule();
  const app = await createOpenApiApp(compiledModule);

  try {
    const config = new DocumentBuilder()
      .setTitle('Meridiano API')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const stableDocument = sortJsonKeys(document as unknown as JsonValue);
    const outputPath = join(process.cwd(), 'openapi.json');

    await writeFile(outputPath, `${JSON.stringify(stableDocument, null, 2)}\n`);
    console.log(`Wrote ${outputPath}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to generate OpenAPI spec:', error);
  process.exit(1);
});
