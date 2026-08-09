import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DigestEntity } from './entities/digest.entity';
import { DigestItem } from './entities/digest.types';

@Injectable()
export class DigestsService {
  constructor(
    @InjectRepository(DigestEntity)
    private readonly digestRepository: Repository<DigestEntity>,
  ) {}

  async saveDigest(items: DigestItem[]): Promise<string> {
    const entity = this.digestRepository.create({ items });
    const saved = await this.digestRepository.save(entity);
    return saved.id;
  }

  async findLatest(): Promise<DigestEntity | null> {
    const [latest] = await this.digestRepository.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return latest ?? null;
  }
}
