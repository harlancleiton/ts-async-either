/**
 * Error thrown when attempting to unwrap a value from the wrong type of Either.
 * This occurs when trying to unwrap() a Left or unwrapError() a Right.
 */
export class EitherUnwrapError extends Error {
  /** Default error code for EitherUnwrapError */
  public static DEFAULT_CODE = 'EITHER_UNWRAP_ERROR';

  /** Default error message for EitherUnwrapError */
  public static DEFAULT_MESSAGE = 'Either unwrap error';

  /**
   * Creates a new EitherUnwrapError.
   *
   * @param message Error message, defaults to DEFAULT_MESSAGE
   * @param code Error code, defaults to DEFAULT_CODE
   */
  constructor(
    message = EitherUnwrapError.DEFAULT_MESSAGE,
    public readonly code = EitherUnwrapError.DEFAULT_CODE,
  ) {
    super(message);
  }
}
