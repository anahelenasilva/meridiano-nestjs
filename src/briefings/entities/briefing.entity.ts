import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('briefings')
export class BriefingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column('simple-json', { name: 'article_ids' })
  articleIds: string[];

  @Column({ name: 'feed_profile', type: 'text' })
  feedProfile: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
