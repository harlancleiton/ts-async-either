export class AsyncEitherSettledError extends Error {
  public readonly status: number;

  constructor(
    public readonly errors: ReadonlyArray<Error & { status?: number }>,
  ) {
    let status = errors.some((err) => {
      if (!err.status) return false;
      const isServerSideException = err.status >= 500;
      return isServerSideException;
    })
      ? 500
      : 400;

    const everyErrorsHaveSameStatus = errors.every(
      (err) => err.status === errors[0]?.status,
    );

    if (everyErrorsHaveSameStatus) {
      status = errors[0]?.status ?? status;
    }

    let message = 'Multiple errors occurred';

    if (errors.length === 1) {
      message = errors[0].message;
    }

    super(message);
    this.status = status;
  }
}
