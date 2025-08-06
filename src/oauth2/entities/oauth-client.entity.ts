import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('oauth_clients')
export class OAuthClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  clientId: string;

  @Column()
  clientSecret: string;

  @Column()
  name: string;

  @Column('simple-array')
  redirectUris: string[];

  @Column('simple-array')
  allowedScopes: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 3600 })
  tokenLifetimeSeconds: number;

  @Column({ type: 'integer', default: 200, comment: 'Max requests allowed' })
  rateLimitCount: number;

  @Column({ type: 'integer', default: 43200, comment: 'Window size in seconds (12 hours)' })
  rateLimitWindowSeconds: number;

  @Column({ type: 'text', nullable: true, comment: 'ID (User UUID or Client ID) of the principal who created this client' })
  creatorPrincipalId: string;

  @Column({ type: 'boolean', default: false, comment: 'Whether IP restriction is enabled for this client' })
  ip_restriction: boolean;

  @Column({ type: 'text', array: true, default: '{}', comment: 'List of allowed IP addresses or CIDR blocks' })
  allowedIps: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 