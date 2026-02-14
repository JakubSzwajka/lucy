import say from "say";

export class SayProvider {
  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      say.speak(text, "Samantha", 1.0, (err) => {
        if (err && !String(err).includes("Killed")) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  stop(): void {
    say.stop();
  }
}
