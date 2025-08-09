import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DufUser } from './duf-user.entity';

@Entity('duf_history')
export class DufHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  requestUrl: string; // The URL that was requested

  @Column({ type: 'text', nullable: true })
  preview: string | Buffer; // Store image data as text or bytea

  // New standardized scrape fields
  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string; // e.g., 'propertyfinder', 'bayut'

  // Flattened location
  @Column({ type: 'varchar', length: 150, nullable: true })
  emirate: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  mainArea: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  subArea: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  subSubArea: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  fullName: string;

  // Area name (zone name from portal) stored explicitly
  @Column({ name: 'area_name_en', type: 'varchar', length: 200, nullable: true })
  areaNameEn: string;

  // Flattened coordinates
  @Column({ type: 'double precision', nullable: true })
  lat: number;

  @Column({ type: 'double precision', nullable: true })
  lng: number;

  @Column({ type: 'text', nullable: true })
  gmap: string;

  // Flattened rera
  @Column({ type: 'text', nullable: true })
  permitUrl: string;

  // Flattened property
  @Column({ type: 'numeric', nullable: true })
  price: string;

  @Column({ type: 'numeric', nullable: true })
  size: string;

  @Column({ type: 'numeric', nullable: true })
  plotArea: string;

  @Column({ type: 'integer', nullable: true })
  bedroomsValue: number;

  @Column({ type: 'integer', nullable: true })
  bathroomsValue: number;

  @Column({ type: 'text', nullable: true })
  imageSmallUrl: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  company: string; // agency/broker company name

  @Column({ type: 'varchar', length: 200, nullable: true })
  buildingName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  unitNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  permitNumber: string;

  // Note: full raw response is no longer stored to avoid duplication

  @Column({ type: 'varchar', length: 50, nullable: true })
  requestStatus: string; // 'success', 'failed', 'partial'

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => DufUser, user => user.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: DufUser;
}