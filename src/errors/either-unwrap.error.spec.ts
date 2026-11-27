import { EitherUnwrapError } from './either-unwrap.error';

describe('EitherUnwrapError', () => {
  it('should use the default message and code', () => {
    const sut = new EitherUnwrapError();

    expect(sut).toBeInstanceOf(Error);
    expect(sut.message).toBe(EitherUnwrapError.DEFAULT_MESSAGE);
    expect(sut.code).toBe(EitherUnwrapError.DEFAULT_CODE);
  });

  it('should accept a custom message and code', () => {
    const sut = new EitherUnwrapError('custom', 'CUSTOM');

    expect(sut.message).toBe('custom');
    expect(sut.code).toBe('CUSTOM');
  });
});
