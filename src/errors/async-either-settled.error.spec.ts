import { AsyncEitherSettledError } from './async-either-settled.error';

function withStatus(
  message: string,
  status: number,
): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

describe('AsyncEitherSettledError', () => {
  it('should use 500 when any error is a server error and statuses differ', () => {
    const errors = [withStatus('missing', 404), withStatus('down', 503)];
    const sut = new AsyncEitherSettledError(errors);

    expect(sut).toBeInstanceOf(Error);
    expect(sut.errors).toEqual(errors);
    expect(sut.status).toBe(500);
    expect(sut.message).toBe('Multiple errors occurred');
  });

  it('should use 400 when client errors do not share a status', () => {
    const sut = new AsyncEitherSettledError([
      withStatus('missing', 404),
      withStatus('invalid', 422),
    ]);

    expect(sut.status).toBe(400);
  });

  it('should keep a shared status', () => {
    const sut = new AsyncEitherSettledError([
      withStatus('a', 409),
      withStatus('b', 409),
    ]);

    expect(sut.status).toBe(409);
  });

  it('should fall back to 400 when errors have no status', () => {
    const sut = new AsyncEitherSettledError([new Error('a'), new Error('b')]);

    expect(sut.status).toBe(400);
    expect(sut.message).toBe('Multiple errors occurred');
  });

  it('should use the single error message', () => {
    const sut = new AsyncEitherSettledError([withStatus('only', 422)]);

    expect(sut.message).toBe('only');
    expect(sut.status).toBe(422);
  });

  it('should default an empty error list to 400', () => {
    const sut = new AsyncEitherSettledError([]);

    expect(sut.status).toBe(400);
    expect(sut.message).toBe('Multiple errors occurred');
    expect(sut.errors).toEqual([]);
  });
});
