import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { DufSubscription } from './duf-subscription.entity';
import { DufHistory } from './duf-history.entity';

@Entity('duf_users')
export class DufUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'boolean', default: false })
  verifiedEmail: boolean;

  @Column()
  password: string; // Will be hashed

  @Column({ type: 'varchar', length: 200, nullable: true })
  company: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  referralCode: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  referredBy: string;

  @Column({ type: 'boolean', default: false })
  isAdmin: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => DufSubscription, subscription => subscription.user)
  subscriptions: DufSubscription[];

  @OneToMany(() => DufHistory, history => history.user)
  history: DufHistory[];
}