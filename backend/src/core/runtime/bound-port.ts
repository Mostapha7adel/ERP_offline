let currentPort = 3000;

/** Record the port the server actually bound (may differ from env.PORT). */
export function setBoundPort(port: number): void {
  currentPort = port;
}

/** The port the server is actually listening on. */
export function getBoundPort(): number {
  return currentPort;
}
