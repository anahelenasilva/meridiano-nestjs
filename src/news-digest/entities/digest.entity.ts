import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DigestItem } from './digest.types';

@Entity('digests')
export class DigestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('simple-json')
  items: DigestItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
