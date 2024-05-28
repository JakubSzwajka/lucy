import { ClientManager } from '../slackClientManager';

export interface Module {
  key: string;
  setup(): Promise<void>;
  clear(): Promise<void>;
}

export abstract class BotModule implements Module {
  protected readonly ClientManager = ClientManager;

  public abstract readonly key: string;
  public abstract setup(): Promise<void>;
  public abstract clear(): Promise<void>;
}
