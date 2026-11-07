/**
 * Laskennan luonnoskirjoitus ja Valmis jakavat yhden jonon.
 * Valmis kasvattaa sukupolvea heti. Luonnos, joka ehti alkaa ennen sitä
 * tai jonoutui sen aikana, ei enää kirjoita valmista riviä keskeneräiseksi.
 * Valmistumisen jälkeinen uusi kutsu on uusi sukupolvi ja saa kirjoittaa.
 */

export type DraftSaveToken = {
  ticket: number;
  /** false, jos kutsu lähti Valmis-kirjoituksen aikana. */
  allowed: boolean;
};

export type ComposerSaveGate = {
  isFinishing: () => boolean;
  capture: () => DraftSaveToken;
  canCommit: (token: DraftSaveToken) => boolean;
  commit: (token: DraftSaveToken, write: () => Promise<void>) => Promise<boolean>;
  finish: (write: () => Promise<void>) => Promise<void>;
};

export function createComposerSaveGate(): ComposerSaveGate {
  let epoch = 0;
  let finishing = false;
  let chain: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(task, task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function canCommit(token: DraftSaveToken): boolean {
    return token.allowed && !finishing && token.ticket === epoch;
  }

  return {
    isFinishing: () => finishing,
    capture: () => ({ ticket: epoch, allowed: !finishing }),
    canCommit,
    commit(token, write) {
      return enqueue(async () => {
        if (!canCommit(token)) return false;
        await write();
        return canCommit(token);
      });
    },
    async finish(write) {
      epoch += 1;
      finishing = true;
      try {
        await enqueue(async () => {
          await write();
        });
      } finally {
        finishing = false;
      }
    },
  };
}
