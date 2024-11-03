export class EitherUnwrapError extends Error {
  public static DEFAULT_CODE = 'EITHER_UNWRAP_ERROR';
  public static DEFAULT_MESSAGE = 'Either unwrap error';

  constructor(
    message = EitherUnwrapError.DEFAULT_MESSAGE,
    public readonly code = EitherUnwrapError.DEFAULT_CODE,
  ) {
    super(message);
  }
}
