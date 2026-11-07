/**
 * Poistumisen kertalukko ja tallennusjono.
 *
 * `allowExit` on päällä vain sen navigoinnin ajan, jonka poistuminen itse käynnistää.
 * Ennen seuraavaa tapahtumasilmukkaa lukko vapautuu, vaikka näkymä jäisi pinoon
 * eikä saisi uutta kohdistusta. Ennen sitä saapunut `beforeRemove` näkee lukon
 * ja päästää juuri tämän poistumisen läpi.
 * Uudempi poistuminen korvaa jonossa odottavan, jotta paluu ei lähde kahdesti.
 */

export class LeaveCancelled extends Error {
  constructor() {
    super('leave-cancelled');
    this.name = 'LeaveCancelled';
  }
}

type Scheduler = (release: () => void) => void;

export type ScreenLeave = {
  shouldBypass: () => boolean;
  reset: () => void;
  setOnRelease: (fn: () => void) => void;
  enqueue: (task: () => Promise<void>) => Promise<void>;
  leave: (save: () => Promise<void>, onLeave: () => void) => Promise<void>;
  allowOnce: (onLeave: () => void) => void;
};

export function createScreenLeave(schedule: Scheduler = defaultSchedule): ScreenLeave {
  let allowExit = false;
  let chain: Promise<void> = Promise.resolve();
  let leaveEpoch = 0;
  let onRelease: () => void = () => undefined;

  function release() {
    allowExit = false;
    onRelease();
  }

  function scheduleRelease() {
    const epochAtArm = leaveEpoch;
    schedule(() => {
      if (leaveEpoch !== epochAtArm) return;
      if (!allowExit) return;
      release();
    });
  }

  function enqueue(task: () => Promise<void>): Promise<void> {
    const run = chain.then(task, task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    shouldBypass: () => allowExit,
    reset: () => {
      if (!allowExit) return;
      release();
    },
    setOnRelease: (fn) => {
      onRelease = fn;
    },
    enqueue,
    leave(save, onLeave) {
      const epoch = ++leaveEpoch;
      return enqueue(async () => {
        if (epoch !== leaveEpoch || allowExit) return;
        await save();
        if (epoch !== leaveEpoch || allowExit) return;
        allowExit = true;
        try {
          onLeave();
        } finally {
          scheduleRelease();
        }
      });
    },
    allowOnce(onLeave) {
      leaveEpoch += 1;
      allowExit = true;
      try {
        onLeave();
      } finally {
        scheduleRelease();
      }
    },
  };
}

function defaultSchedule(release: () => void) {
  setTimeout(release, 0);
}
