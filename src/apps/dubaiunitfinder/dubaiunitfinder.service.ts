import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { DufUser } from './entities/duf-user.entity';
import { DufSubscription } from './entities/duf-subscription.entity';
import { DufHistory } from './entities/duf-history.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class DubaiunitfinderService {
  constructor(
    @InjectRepository(DufUser, 'dubaiunitfinder')
    private readonly userRepository: Repository<DufUser>,
    @InjectRepository(DufSubscription, 'dubaiunitfinder')
    private readonly subscriptionRepository: Repository<DufSubscription>,
    @InjectRepository(DufHistory, 'dubaiunitfinder')
    private readonly historyRepository: Repository<DufHistory>,
  ) {}

  private generateReferralCode(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${timestamp}${randomStr}`.substring(0, 12);
  }

  private async ensureUniqueReferralCode(): Promise<string> {
    let referralCode = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      referralCode = this.generateReferralCode();
      const existingUser = await this.userRepository.findOne({
        where: { referralCode }
      });
      isUnique = !existingUser;
      attempts++;
    }

    if (!isUnique) {
      throw new Error('Unable to generate unique referral code');
    }

    return referralCode;
  }

  private convertPreviewToString(preview: any): string | null {
    if (!preview) return null;
    
    // Since we're storing everything as text now, just return as-is
    return String(preview);
  }

  // Auth Services
  async registerUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    company?: string;
    referredBy?: string;
  }): Promise<{ success: boolean; message: string; userId?: string }> {
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: { email: userData.email }
      });

      if (existingUser) {
        return { success: false, message: 'User already exists with this email' };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Generate unique referral code for the new user
      const referralCode = await this.ensureUniqueReferralCode();

      // Create user
      const user = this.userRepository.create({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: hashedPassword,
        company: userData.company,
        referralCode,
        referredBy: userData.referredBy,
      });

      const savedUser = await this.userRepository.save(user);

      return { 
        success: true, 
        message: 'User registered successfully', 
        userId: savedUser.id 
      };
    } catch (error) {
      return { success: false, message: 'Registration failed' };
    }
  }

  async signInUser(email: string, password: string): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      const user = await this.userRepository.findOne({
        where: { email, isActive: true }
      });

      if (!user) {
        return { success: false, message: 'Invalid credentials' };
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return { success: false, message: 'Invalid credentials' };
      }

      // Don't return password
      const { password: _, ...userWithoutPassword } = user;
      
      return { 
        success: true, 
        message: 'Sign in successful', 
        user: userWithoutPassword 
      };
    } catch (error) {
      return { success: false, message: 'Sign in failed' };
    }
  }

  // Subscription Services
  async getUserSubscriptions(userId: string): Promise<{ success: boolean; subscriptions: DufSubscription[] }> {
    try {
      const subscriptions = await this.subscriptionRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' }
      });

      return { success: true, subscriptions };
    } catch (error) {
      return { success: false, subscriptions: [] };
    }
  }

  async createSubscription(subscriptionData: {
    userId: string;
    packageName: string;
    requestsInPackage: number;
    expiryDate: Date;
    price?: number;
  }): Promise<{ success: boolean; message: string; subscriptionId?: string }> {
    try {
      const subscription = this.subscriptionRepository.create({
        ...subscriptionData,
        subscriptionDate: new Date(),
      });

      const savedSubscription = await this.subscriptionRepository.save(subscription);

      return { 
        success: true, 
        message: 'Subscription created successfully', 
        subscriptionId: savedSubscription.id 
      };
    } catch (error) {
      return { success: false, message: 'Failed to create subscription' };
    }
  }

  // History Services
  async getUserHistory(userId: string, limit: number = 10): Promise<{ success: boolean; history: any[] }> {
    try {
      const history = await this.historyRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit
      });

      // Convert preview to string format
      const transformedHistory = history.map(hist => ({
        ...hist,
        preview: this.convertPreviewToString(hist.preview)
      }));

      return { success: true, history: transformedHistory };
    } catch (error) {
      return { success: false, history: [] };
    }
  }

  async addHistoryEntry(historyData: {
    userId: string;
    requestUrl: string;
    preview?: string; // base64 encoded image data
    source?: string;
    // Flattened fields
    emirate?: string | null;
    mainArea?: string | null;
    subArea?: string | null;
    subSubArea?: string | null;
    fullName?: string | null;
    lat?: number | null;
    lng?: number | null;
    gmap?: string | null;
    permitUrl?: string | null;
    price?: string | number | null;
    size?: string | number | null;
    plotArea?: string | number | null;
    bedroomsValue?: number | null;
    bathroomsValue?: number | null;
    imageSmallUrl?: string | null;
    company?: string;
    buildingName?: string;
    unitNumber?: string;
    permitNumber?: string;
    areaNameEn?: string | null;
    responseData?: any;
    requestStatus?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Map incoming data to entity columns
      const toCreate: DeepPartial<DufHistory> = {
        userId: historyData.userId,
        requestUrl: historyData.requestUrl,
        preview: historyData.preview,
        source: historyData.source,
        emirate: historyData.emirate ?? undefined,
        mainArea: historyData.mainArea ?? undefined,
        subArea: historyData.subArea ?? undefined,
        subSubArea: historyData.subSubArea ?? undefined,
        fullName: historyData.fullName ?? undefined,
        lat: historyData.lat ?? undefined,
        lng: historyData.lng ?? undefined,
        gmap: historyData.gmap ?? undefined,
        permitUrl: historyData.permitUrl ?? undefined,
        price: (historyData.price as any) ?? undefined,
        size: (historyData.size as any) ?? undefined,
        plotArea: (historyData.plotArea as any) ?? undefined,
        bedroomsValue: historyData.bedroomsValue ?? undefined,
        bathroomsValue: historyData.bathroomsValue ?? undefined,
        imageSmallUrl: historyData.imageSmallUrl ?? undefined,
        areaNameEn: historyData.areaNameEn ?? undefined,
        company: historyData.company,
        buildingName: historyData.buildingName,
        unitNumber: historyData.unitNumber,
        permitNumber: historyData.permitNumber,
        requestStatus: historyData.requestStatus,
      };
      const historyEntry = this.historyRepository.create(toCreate);
      await this.historyRepository.save(historyEntry);

      return { success: true, message: 'History entry added successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to add history entry' };
    }
  }

  // Admin Services
  async getAllUsers(page: number = 1, limit: number = 50): Promise<{ success: boolean; users: any[]; total: number }> {
    try {
      const [users, total] = await this.userRepository.findAndCount({
        select: ['id', 'firstName', 'lastName', 'email', 'verifiedEmail', 'company', 'referralCode', 'isAdmin', 'isActive', 'createdAt'],
        skip: (page - 1) * limit,
        take: limit,
        order: { createdAt: 'DESC' }
      });

      return { success: true, users, total };
    } catch (error) {
      return { success: false, users: [], total: 0 };
    }
  }

  async getUserById(userId: string): Promise<{ success: boolean; user?: any }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'firstName', 'lastName', 'email', 'verifiedEmail', 'company', 'referralCode', 'referredBy', 'isAdmin', 'isActive', 'createdAt', 'updatedAt'],
        relations: ['subscriptions', 'history']
      });

      if (!user) {
        return { success: false };
      }

      return { success: true, user };
    } catch (error) {
      return { success: false };
    }
  }

  // Admin Subscription Services
  async getAllSubscriptions(page: number = 1, limit: number = 50): Promise<{ success: boolean; subscriptions: any[]; total: number }> {
    try {
      const [subscriptions, total] = await this.subscriptionRepository.findAndCount({
        relations: ['user'],
        skip: (page - 1) * limit,
        take: limit,
        order: { createdAt: 'DESC' }
      });

      // Transform to exclude sensitive user data
      const transformedSubscriptions = subscriptions.map(sub => ({
        ...sub,
        user: sub.user ? {
          id: sub.user.id,
          firstName: sub.user.firstName,
          lastName: sub.user.lastName,
          email: sub.user.email
        } : null
      }));

      return { success: true, subscriptions: transformedSubscriptions, total };
    } catch (error) {
      return { success: false, subscriptions: [], total: 0 };
    }
  }

  // Admin History Services
  async getAllHistory(page: number = 1, limit: number = 50): Promise<{ success: boolean; history: any[]; total: number }> {
    try {
      const [history, total] = await this.historyRepository.findAndCount({
        relations: ['user'],
        skip: (page - 1) * limit,
        take: limit,
        order: { createdAt: 'DESC' }
      });

      // Transform to exclude sensitive user data and convert preview to string
      const transformedHistory = history.map(hist => ({
        ...hist,
        preview: this.convertPreviewToString(hist.preview),
        user: hist.user ? {
          id: hist.user.id,
          firstName: hist.user.firstName,
          lastName: hist.user.lastName,
          email: hist.user.email
        } : null
      }));

      return { success: true, history: transformedHistory, total };
    } catch (error) {
      return { success: false, history: [], total: 0 };
    }
  }

  // Admin User Management Services
  async updateUserStatus(userId: string, updates: { isAdmin?: boolean; isActive?: boolean }): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      await this.userRepository.update(userId, updates);

      return { success: true, message: 'User status updated successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to update user status' };
    }
  }

  async addSubscriptionToUser(subscriptionData: {
    userId: string;
    packageName: string;
    requestsInPackage: number;
    expiryDate: Date;
    price?: number;
  }): Promise<{ success: boolean; message: string; subscriptionId?: string }> {
    try {
      // Check if user exists
      const user = await this.userRepository.findOne({
        where: { id: subscriptionData.userId }
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const subscription = this.subscriptionRepository.create({
        ...subscriptionData,
        subscriptionDate: new Date(),
      });

      const savedSubscription = await this.subscriptionRepository.save(subscription);

      return { 
        success: true, 
        message: 'Subscription added to user successfully', 
        subscriptionId: savedSubscription.id 
      };
    } catch (error) {
      return { success: false, message: 'Failed to add subscription to user' };
    }
  }
}