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

  @Column({ name: 'is_custom', type: 'boolean', default: false })
  isCustom: boolean;

  @Column({ name: 'custom_title', type: 'text', nullable: true })
  customTitle: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
