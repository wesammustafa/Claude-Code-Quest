// A stand-in for the Web Audio API, for the Scene's sound tests: jsdom has
// none. It keeps every context and oscillator made, with when each note
// was told to start and stop, so a test reads what would have sounded.

class FakeParam {
  value: number;
  readonly calls: string[] = [];
  constructor(value: number) {
    this.value = value;
  }
  setValueAtTime(value: number, at: number) {
    this.calls.push(`set ${String(value)} @${String(at)}`);
    return this;
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.calls.push(`linear ${String(value)} @${String(at)}`);
    return this;
  }
  exponentialRampToValueAtTime(value: number, at: number) {
    this.calls.push(`exp ${String(value)} @${String(at)}`);
    return this;
  }
  cancelScheduledValues(at: number) {
    this.calls.push(`cancel @${String(at)}`);
    return this;
  }
}

class FakeNode {
  readonly connected: unknown[] = [];
  connect(to: unknown) {
    this.connected.push(to);
    return to;
  }
}

export class FakeOscillator extends FakeNode {
  type = "sine";
  readonly frequency = new FakeParam(440);
  started: number | null = null;
  stopped: number | null = null;
  onended: (() => void) | null = null;
  start(at: number) {
    this.started = at;
  }
  stop(at: number) {
    this.stopped = at;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}

export class FakeAudioContext {
  static made: FakeAudioContext[] = [];
  state: "suspended" | "running" | "closed" = "suspended";
  currentTime = 0;
  readonly destination = new FakeNode();
  readonly oscillators: FakeOscillator[] = [];
  constructor() {
    FakeAudioContext.made.push(this);
  }
  createOscillator() {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createGain() {
    return new FakeGain();
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

/** Every oscillator any context started, in order. */
export function startedNotes(): FakeOscillator[] {
  return FakeAudioContext.made.flatMap((ctx) =>
    ctx.oscillators.filter((osc) => osc.started !== null),
  );
}

export function resetAudio(): void {
  FakeAudioContext.made = [];
}
