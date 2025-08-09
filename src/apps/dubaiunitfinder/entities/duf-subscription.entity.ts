import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DufUser } from './duf-user.entity';

@Entity('duf_subscriptions')
export class DufSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  packageName: string; // e.g., 'basic', 'premium', 'enterprise'

  @Column({ type: 'date' })
  subscriptionDate: Date;

  @Column({ type: 'date' })
  expiryDate: Date;

  @Column({ type: 'integer' })
  requestsInPackage: number; // Total requests allowed in this package

  @Column({ type: 'integer', default: 0 })
  requestsUsed: number; // Requests used so far

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number; // Package price

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => DufUser, user => user.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: DufUser;
}