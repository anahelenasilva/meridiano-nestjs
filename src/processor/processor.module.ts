import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigModule } from '../config/config.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsecasesModule } from '../usecases/usecases.module';
import { ProcessorService } from './processor.service';

@Module({
  imports: [
    forwardRef(() => ArticlesModule),
    AiModule,
    ConfigModule,
    ProfilesModule,
    forwardRef(() => UsecasesModule),
  ],
  providers: [ProcessorService],
  exports: [ProcessorService],
})
export class ProcessorModule { }
