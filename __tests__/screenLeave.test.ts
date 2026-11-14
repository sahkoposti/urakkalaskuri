import { createScreenLeave, LeaveCancelled } from '../src/core/wizard/screenLeave';

/**
 * Jest on node-ympäristö eikä tässä repossa ole react-test-rendereriä tai
 * @testing-libraryä. Koukkua ja näyttöä ei voi mountata. Nämä testit ajavat
 * saman jonon, jonka useUnsavedChangesGuard ja laskentanäkymä kutsuvat:
 * leave, allowOnce, enqueue, reset ja ennen seuraavaa tapahtumaa ajoitettu vapautus.
 */
describe('screen leave latch', () => {
  function harness() {
    const releases: Array<() => void> = [];
    const leave = createScreenLeave((release) => {
      releases.push(release);
    });
    return { leave, releases };
  }

  it('saves on leave, lets the nested back through, then arms the next save without a focus event', async () => {
    const { leave, releases } = harness();
    const saves: string[] = [];
    let nestedBlocked = false;

    await leave.leave(
      async () => {
        saves.push('first');
      },
      () => {
        if (leave.shouldBypass()) return;
        nestedBlocked = true;
      },
    );

    expect(saves).toEqual(['first']);
    expect(nestedBlocked).toBe(false);
    expect(leave.shouldBypass()).toBe(true);
    expect(releases).toHaveLength(1);

    releases[0]();
    expect(leave.shouldBypass()).toBe(false);

    await leave.leave(
      async () => {
        saves.push('second');
      },
      () => undefined,
    );
    expect(saves).toEqual(['first', 'second']);
  });

  it('keeps a later save when reset runs because the screen stayed mounted', async () => {
    const { leave } = harness();
    const saves: string[] = [];
    await leave.leave(async () => {
      saves.push('armed');
    }, () => undefined);
    leave.reset();
    expect(leave.shouldBypass()).toBe(false);
    await leave.leave(async () => {
      saves.push('after-reset');
    }, () => undefined);
    expect(saves).toEqual(['armed', 'after-reset']);
  });

  it('serializes a background save behind an in-flight leave and navigates once', async () => {
    const { leave } = harness();
    const order: string[] = [];
    let finishSave: () => void = () => undefined;
    let started!: () => void;
    const saveStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const leaving = leave.leave(
      () =>
        new Promise<void>((resolve) => {
          order.push('leave-started');
          started();
          finishSave = () => {
            order.push('leave-save');
            resolve();
          };
        }),
      () => {
        order.push('navigate');
      },
    );
    await saveStarted;
    const replaced = leave.leave(
      async () => {
        order.push('replaced-save');
      },
      () => {
        order.push('replaced-navigate');
      },
    );
    const background = leave.enqueue(async () => {
      order.push('background');
    });

    finishSave();
    await leaving;
    await replaced;
    await background;
    expect(order).toEqual(['leave-started', 'leave-save', 'replaced-save', 'replaced-navigate', 'background']);
  });

  it('does not navigate when the save is cancelled', async () => {
    const { leave } = harness();
    let left = false;
    await expect(
      leave.leave(async () => {
        throw new LeaveCancelled();
      }, () => {
        left = true;
      }),
    ).rejects.toBeInstanceOf(LeaveCancelled);
    expect(left).toBe(false);
    expect(leave.shouldBypass()).toBe(false);
  });
});
