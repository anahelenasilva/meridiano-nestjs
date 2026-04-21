import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedProfile } from '../shared/types/feed';
import { BriefingEntity } from './entities/briefing.entity';
import { BriefsMetadata, GetBriefByIdResult } from './entities/briefing.types';

@Injectable()
export class BriefingsService {
  constructor(
    @InjectRepository(BriefingEntity)
    private readonly briefingRepository: Repository<BriefingEntity>,
  ) {}

  async saveBrief(
    content: string,
    articleIds: string[],
    feedProfile: FeedProfile,
  ): Promise<string> {
    const entity = this.briefingRepository.create({
      content,
      articleIds,
      feedProfile,
    });
    const saved = await this.briefingRepository.save(entity);
    return saved.id;
  }

  async getAllBriefsMetadata(
    feedProfile?: FeedProfile,
  ): Promise<BriefsMetadata[]> {
    const entities = await this.briefingRepository.find({
      where: feedProfile ? { feedProfile } : {},
      order: { createdAt: 'DESC' },
      select: { id: true, createdAt: true, feedProfile: true },
    });

    return entities.map((e) => ({
      id: e.id,
      generated_at: e.createdAt,
      feed_profile: e.feedProfile,
    }));
  }

  async getBriefById(briefId: string): Promise<GetBriefByIdResult | null> {
    const entity = await this.briefingRepository.findOne({
      where: { id: briefId },
    });

    if (!entity) {
      return null;
    }

    return {
      id: entity.id,
      brief_markdown: entity.content,
      generated_at: entity.createdAt,
      feed_profile: entity.feedProfile,
    };
  }
}
