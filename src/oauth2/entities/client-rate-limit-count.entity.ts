import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { OAuthClient } from './oauth-client.entity';

@Entity('client_rate_limit_counts')
export class ClientRateLimitCount {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  clientId: string;

  @PrimaryColumn({ type: 'date' })
  date: string; // Store date as string in YYYY-MM-DD format

  @Column({ type: 'integer', default: 0 })
  count: number;

  @ManyToOne(() => OAuthClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId', referencedColumnName: 'clientId' })
  client: OAuthClient;
} 