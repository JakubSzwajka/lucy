import { Injectable } from '@nestjs/common';
import { call } from 'src/ai';

@Injectable()
export class LucyService {
  async talk(message: string): Promise<string> {
    return await call(message);
  }
}
