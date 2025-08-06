import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { OAuthClient } from './oauth-client.entity';
import { User } from '../../users/entities/user.entity';

@Entity('access_tokens')
export class AccessToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  accessToken: string;

  @Column('simple-array')
  scopes: string[];

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => OAuthClient)
  @JoinColumn({ name: 'clientId' })
  client: OAuthClient;

  @Column()
  clientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @Column({ default: false })
  revoked: boolean;
} 