import { Injectable } from '@nestjs/common';

@Injectable()
export class TestService {
  getTestResult(): { success: boolean } {
    return { success: true };
  }
}