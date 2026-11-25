// 시험용 사용자: 쿠키를 기억하는 fetch · WebSocket
export const API_BASE = process.env.API_BASE ?? 'http://localhost:8799';

export class TestUser {
  /** 이름 → 값(게스트는 gid · gname, 회원은 sid) */
  readonly #cookies = new Map<string, string>();

  constructor(readonly username: string, readonly password = 'correct-horse-9') {}

  static fresh(prefix = 't'): TestUser {
    return new TestUser(`${prefix}${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`);
  }

  async request(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
    const response = await fetch(API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: this.#cookieHeader() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const [name, ...value] = pair.split('=');
      const deleted = /max-age=0|expires=thu, 01 jan 1970/i.test(line);
      if (deleted) this.#cookies.delete(name.trim());
      else this.#cookies.set(name.trim(), value.join('='));
    }
    const text = await response.text();
    return { status: response.status, json: text ? JSON.parse(text) : null };
  }

  /** 다른 시험 사용자의 쿠키(게스트 등)를 이어받음 */
  adoptCookieFrom(other: TestUser): void {
    for (const [name, value] of other.#cookies) this.#cookies.set(name, value);
  }

  #cookieHeader(): string {
    return [...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  signup() {
    return this.request('POST', '/api/auth/signup', { username: this.username, password: this.password });
  }

  login(password = this.password) {
    return this.request('POST', '/api/auth/login', { username: this.username, password });
  }

  /** 받은 글을 차례로 꺼낼 수 있는 WebSocket */
  async connect(path: string): Promise<LiveSocket> {
    const socket = new WebSocket(API_BASE.replace(/^http/, 'ws') + path, { headers: { Cookie: this.#cookieHeader() } } as unknown as string[]);
    const live = new LiveSocket(socket);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return live;
  }
}

export class LiveSocket {
  readonly #inbox: any[] = [];
  readonly #waiters: ((message: any) => void)[] = [];

  constructor(readonly socket: WebSocket) {
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      const waiter = this.#waiters.shift();
      if (waiter) waiter(message);
      else this.#inbox.push(message);
    });
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }

  /** 조건에 맞는 글이 올 때까지 기다림(그 전 글은 버림) */
  async next(match: (message: any) => boolean = () => true, timeoutMs = 8000): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const message = this.#inbox.shift() ?? (await new Promise(resolve => {
        this.#waiters.push(resolve);
        setTimeout(() => resolve(undefined), deadline - Date.now());
      }));
      if (message !== undefined && match(message)) return message;
    }
    throw new Error('기다리던 글이 오지 않음');
  }

  close(): void {
    this.socket.close();
  }
}
