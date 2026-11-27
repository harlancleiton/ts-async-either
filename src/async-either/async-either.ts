import { Either, left, right } from '../either';
import { AsyncEitherSettledError } from '../errors';

/**
 * Promises placed here already settle to an Either.
 * Rejections are bugs and must propagate; they must not be reified as Left.
 */
const passthrough = new WeakSet<object>();

/**
 * Distinguishes a fail-fast Left inside `AsyncEither.all` from a thrown bug.
 * Promise.all only reports the rejection reason, so Left values are wrapped
 * and then unwrapped. Anything else is rethrown.
 */
class FailFastLeft {
  constructor(public readonly error: unknown) {}
}

// `any` keeps the constraint bivariant so AsyncEither<L, R> is accepted.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAsyncEither = AsyncEither<any, any>;

/**
 * An asynchronous version of Either that wraps a Promise of an Either.
 * Provides a way to work with Either in asynchronous contexts.
 * Implements the Promise interface for compatibility with Promise-based APIs.
 *
 * Rejections of the inner promise are Left values only for `tryCatch`,
 * `fromPromise`, and `new AsyncEither(promise)`. Exceptions thrown by
 * `map`, `flatMap`, `mapError`, `filter`, `recover`, `tap`, `tapError`,
 * and `tapBoth` callbacks propagate and reject the AsyncEither.
 *
 * @template L The type of the Left value (usually an error)
 * @template R The type of the Right value (usually the success value)
 */
export class AsyncEither<L, R> implements Promise<Either<L, R>> {
  private promise: Promise<Either<L, R>>;

  /**
   * Creates a new AsyncEither from a Promise or an Either.
   * A rejected promise becomes a Left. Pass `mapError` to turn the
   * unknown rejection into `L`. Without it, the rejection is asserted as `L`.
   *
   * @param promiseOrEither A Promise that resolves to a value or an Either, or an Either
   * @param mapError Maps a rejection to the Left type
   */
  constructor(promiseOrEither: Promise<R | Either<L, R>> | Either<L, R>);
  constructor(
    promiseOrEither: Promise<R | Either<L, R>> | Either<L, R>,
    mapError: (error: unknown) => L,
  );
  constructor(
    promiseOrEither: Promise<R | Either<L, R>> | Either<L, R>,
    mapError?: (error: unknown) => L,
  ) {
    if (
      mapError === undefined &&
      typeof promiseOrEither === 'object' &&
      promiseOrEither !== null &&
      passthrough.has(promiseOrEither)
    ) {
      this.promise = promiseOrEither as Promise<Either<L, R>>;
      return;
    }

    this.promise = Promise.resolve(promiseOrEither)
      .then((result) => {
        if (result instanceof Either) return result;
        return right<L, R>(result);
      })
      .catch((error: unknown) =>
        left<L, R>(mapError ? mapError(error) : (error as L)),
      );
  }

  /**
   * Creates an AsyncEither from a Promise that might reject.
   * Fulfillment becomes a Right. Rejection becomes a Left.
   *
   * Without `mapError`, the rejection is asserted as `L` (legacy).
   * Pass `mapError` so `L` is produced from `unknown`.
   *
   * @param promise A Promise that might reject
   * @param mapError Maps a rejection to the Left type
   */
  public static tryCatch<L, R>(promise: Promise<R>): AsyncEither<L, R>;
  public static tryCatch<L, R>(
    promise: Promise<R>,
    mapError: (error: unknown) => L,
  ): AsyncEither<L, R>;
  public static tryCatch<L, R>(
    promise: Promise<R>,
    mapError?: (error: unknown) => L,
  ): AsyncEither<L, R> {
    if (mapError) return new AsyncEither(promise, mapError);
    return new AsyncEither<L, R>(promise);
  }

  /**
   * Creates an AsyncEither from a Promise.
   * Type parameters are `<R, L>`, with `L` defaulting to `Error`.
   * Pass `mapError` so `L` is produced from `unknown` instead of asserted.
   *
   * @param promise A Promise to wrap
   * @param mapError Maps a rejection to the Left type
   */
  public static fromPromise<R, L = Error>(
    promise: Promise<R>,
  ): AsyncEither<L, R>;
  public static fromPromise<R, L>(
    promise: Promise<R>,
    mapError: (error: unknown) => L,
  ): AsyncEither<L, R>;
  public static fromPromise<R, L = Error>(
    promise: Promise<R>,
    mapError?: (error: unknown) => L,
  ): AsyncEither<L, R> {
    if (mapError) return AsyncEither.tryCatch(promise, mapError);
    return AsyncEither.tryCatch<L, R>(promise);
  }

  /**
   * Creates an AsyncEither from an Either.
   *
   * @param either An Either to wrap
   */
  public static fromEither<L, R>(either: Either<L, R>): AsyncEither<L, R> {
    return new AsyncEither(either);
  }

  /**
   * Combines AsyncEither values in parallel and fails fast on the first Left.
   * If every input is Right, the result is a Right of the value tuple.
   * If any input is Left, the result is a Left of the first error.
   * A rejection (a callback bug) propagates instead of becoming a Left.
   *
   * @param promises AsyncEither instances to combine
   */
  public static all<T extends readonly AnyAsyncEither[]>(
    promises: [...T],
  ): AsyncEither<
    T[number] extends AsyncEither<infer E, infer _Ignored> ? E : never,
    {
      [K in keyof T]: T[K] extends AsyncEither<infer _Ignored, infer RV>
        ? RV
        : never;
    }
  > {
    type Err =
      T[number] extends AsyncEither<infer E, infer _Ignored> ? E : never;
    type Values = {
      [K in keyof T]: T[K] extends AsyncEither<infer _Ignored, infer RV>
        ? RV
        : never;
    };

    const settled = Promise.all(
      promises.map((promise) =>
        promise.then((either) => {
          if (either.isLeft()) throw new FailFastLeft(either.unwrapError());
          return either.unwrap();
        }),
      ),
    ).then(
      (values) => right<Err, Values>(values as unknown as Values),
      (reason: unknown) => {
        if (reason instanceof FailFastLeft) {
          return left<Err, Values>(reason.error as Err);
        }
        throw reason;
      },
    );

    return AsyncEither.adopt(settled);
  }

  /**
   * Wraps each AsyncEither or Promise as its own AsyncEither.
   * Results are not combined: each one succeeds or fails independently.
   * A raw Promise uses `unknown` as its Left type.
   *
   * @param promises AsyncEither instances or Promises to wrap
   */
  public static allSettled<T extends readonly unknown[]>(
    promises: [...T],
  ): {
    [K in keyof T]: T[K] extends AsyncEither<infer EL, infer ER>
      ? AsyncEither<EL, ER>
      : T[K] extends Promise<infer PR>
        ? AsyncEither<unknown, PR>
        : never;
  } {
    type Result = {
      [K in keyof T]: T[K] extends AsyncEither<infer EL, infer ER>
        ? AsyncEither<EL, ER>
        : T[K] extends Promise<infer PR>
          ? AsyncEither<unknown, PR>
          : never;
    };

    // Array.map does not preserve tuple types.
    const settled = promises.map((item) => {
      if (item instanceof AsyncEither) return item;
      return AsyncEither.tryCatch<unknown, unknown>(Promise.resolve(item));
    });

    return settled as unknown as Result;
  }

  /**
   * Waits for every AsyncEither to settle.
   * All Right: a Right of the value tuple.
   * One Left: that error, unwrapped.
   * Several Lefts: an `AsyncEitherSettledError` containing each error.
   * An empty list is a Right of `[]`.
   * A rejection (a callback bug) propagates instead of becoming a Left.
   *
   * @param asyncEithers AsyncEither instances to combine
   */
  public static fromMany<T extends readonly AnyAsyncEither[]>(
    asyncEithers: [...T],
  ): AsyncEither<
    | AsyncEitherSettledError
    | (T[number] extends AsyncEither<infer E, infer _Ignored> ? E : never),
    {
      [K in keyof T]: T[K] extends AsyncEither<infer _Ignored, infer RV>
        ? RV
        : never;
    }
  > {
    type Err =
      | AsyncEitherSettledError
      | (T[number] extends AsyncEither<infer E, infer _Ignored> ? E : never);
    type Values = {
      [K in keyof T]: T[K] extends AsyncEither<infer _Ignored, infer RV>
        ? RV
        : never;
    };

    if (asyncEithers.length === 0) {
      return AsyncEither.fromEither(
        right<Err, Values>([] as unknown as Values),
      );
    }

    const settled = Promise.all(
      asyncEithers.map((ae) => ae.then((e) => e)),
    ).then((results): Either<Err, Values> => {
      const errors: unknown[] = [];
      const values: unknown[] = [];

      results.forEach((result) => {
        if (result.isLeft()) errors.push(result.unwrapError());
        else values.push(result.unwrap());
      });

      if (errors.length === 0) {
        return right(values as unknown as Values);
      }

      if (errors.length === 1) {
        return left(errors[0] as Err);
      }

      return left(
        new AsyncEitherSettledError(errors as Error[]) as unknown as Err,
      );
    });

    return AsyncEither.adopt(settled);
  }

  /**
   * Builds an AsyncEither whose promise is used as-is.
   * Used for chains that must not convert rejections into Left.
   */
  private static adopt<L, R>(
    promise: Promise<Either<L, R>>,
  ): AsyncEither<L, R> {
    passthrough.add(promise);
    return new AsyncEither<L, R>(promise as Promise<R | Either<L, R>>);
  }

  /**
   * Implementation of the Promise interface's Symbol.toStringTag.
   */
  public get [Symbol.toStringTag](): string {
    return 'AsyncEither';
  }

  /**
   * Implementation of the Promise interface's then method.
   */
  public then<TResult1 = Either<L, R>, TResult2 = never>(
    onfulfilled?:
      | ((value: Either<L, R>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  /**
   * Implementation of the Promise interface's catch method.
   */
  public catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<Either<L, R> | TResult> {
    return this.promise.catch(onrejected);
  }

  /**
   * Implementation of the Promise interface's finally method.
   */
  public finally(onfinally?: (() => void) | null): Promise<Either<L, R>> {
    return this.promise.finally(onfinally);
  }

  /**
   * Transforms the Right value.
   * A Left is returned unchanged and `fn` is not called.
   * If `fn` throws or rejects, the AsyncEither rejects.
   *
   * @param fn A function to apply to the Right value
   */
  public map<T>(fn: (value: R) => T | Promise<T>): AsyncEither<L, T> {
    return this.chain(async (either) => {
      if (either.isLeft()) return left<L, T>(either.unwrapError());
      const mappedValue = await fn(either.unwrap());
      return right<L, T>(mappedValue);
    });
  }

  public filter<U, S extends R>(
    fn: (value: R) => value is S,
    exceptionFactory: (value: R) => U,
  ): AsyncEither<L | U, S>;

  public filter<U>(
    fn: (value: R) => boolean | Promise<boolean>,
    exceptionFactory: (value: R) => U,
  ): AsyncEither<L | U, R>;

  /**
   * Converts a Right to a Left if the predicate fails.
   * A Left is returned unchanged and `fn` is not called.
   * If `fn` or `exceptionFactory` throws or rejects, the AsyncEither rejects.
   *
   * @param fn A predicate for the Right value
   * @param exceptionFactory Creates the error when the predicate fails
   */
  public filter<U>(
    fn: (value: R) => boolean | Promise<boolean>,
    exceptionFactory: (value: R) => U,
  ): AsyncEither<L | U, R> {
    return this.chain(async (either) => {
      if (either.isLeft()) return left<L, R>(either.unwrapError());

      const isValid = await fn(either.unwrap());
      return isValid
        ? right<L, R>(either.unwrap())
        : left<L | U, R>(exceptionFactory(either.unwrap()));
    });
  }

  /**
   * Maps the Right value and flattens the resulting Either or AsyncEither.
   * A Left is returned unchanged and `fn` is not called.
   * If `fn` throws or rejects, the AsyncEither rejects.
   *
   * @param fn A function that returns an Either, a Promise of an Either, or an AsyncEither
   */
  public flatMap<U, T>(
    fn: (value: R) => Either<U, T> | Promise<Either<U, T>> | AsyncEither<U, T>,
  ): AsyncEither<L | U, T> {
    return this.chain(async (either) => {
      if (either.isLeft()) return left<L | U, T>(either.unwrapError());

      // An async return unwraps Either, Promise<Either>, and AsyncEither.
      return fn(either.unwrap());
    });
  }

  /**
   * Transforms the Left value.
   * A Right is returned unchanged and `fn` is not called.
   * If `fn` throws or rejects, the AsyncEither rejects.
   *
   * @param fn A function to apply to the Left value
   */
  public mapError<U>(fn: (error: L) => U | Promise<U>): AsyncEither<U, R> {
    return this.chain(async (either) => {
      if (either.isRight()) return right<U, R>(either.unwrap());
      const mappedError = await fn(either.unwrapError());
      return left<U, R>(mappedError);
    });
  }

  /**
   * Recovers from a Left by replacing it with another AsyncEither.
   * A Right is returned unchanged and `fn` is not called.
   * If `fn` throws or rejects, the AsyncEither rejects.
   *
   * @param fn A function that receives the Left value and returns an AsyncEither
   */
  public recover<U>(
    fn: (err: L) => AsyncEither<L | U, R>,
  ): AsyncEither<L | U, R> {
    return this.chain(async (either) => {
      if (either.isRight()) return right<L | U, R>(either.unwrap());

      return fn(either.unwrapError());
    });
  }

  /**
   * Extracts the Right value, or the default when this is a Left.
   * The default may be a value or a function (sync or async).
   * If the function throws or rejects, this promise rejects.
   *
   * @param defaultValue The fallback value, or a function that produces it
   */
  public async getOrElse(defaultValue: R | (() => Promise<R> | R)): Promise<R> {
    const either = await this.promise;
    if (either.isRight()) {
      return either.unwrap();
    }
    return defaultValue instanceof Function ? defaultValue() : defaultValue;
  }

  /**
   * Extracts the Left value, or the default when this is a Right.
   * The default may be a value or a function (sync or async).
   * If the function throws or rejects, this promise rejects.
   *
   * @param defaultError The fallback error, or a function that produces it
   */
  public async getErrorOrElse(
    defaultError: L | (() => Promise<L> | L),
  ): Promise<L> {
    const either = await this.promise;
    if (either.isLeft()) {
      return either.unwrapError();
    }
    return defaultError instanceof Function ? defaultError() : defaultError;
  }

  /**
   * Performs a side effect on the Right value.
   * A Left skips `fn`. The AsyncEither's value is unchanged when `fn` succeeds.
   * If `fn` throws or rejects, the AsyncEither rejects. Nothing is logged.
   *
   * @param fn A function to execute on the Right value
   */
  public tap(fn: (value: R) => void | Promise<void>): AsyncEither<L, R> {
    return this.chain(async (either) => {
      if (!either.isRight()) return either;
      await fn(either.unwrap());
      return either;
    });
  }

  /**
   * Performs a side effect on the Left value.
   * A Right skips `fn`. The AsyncEither's error is unchanged when `fn` succeeds.
   * If `fn` throws or rejects, the AsyncEither rejects. Nothing is logged.
   *
   * @param fn A function to execute on the Left value
   */
  public tapError(fn: (error: L) => void | Promise<void>): AsyncEither<L, R> {
    return this.chain(async (either) => {
      if (!either.isLeft()) return either;
      await fn(either.unwrapError());
      return either;
    });
  }

  /**
   * Performs a side effect on the active side.
   * If the callback throws or rejects, the AsyncEither rejects. Nothing is logged.
   *
   * @param rightFn Called with the Right value, or null to skip
   * @param leftFn Called with the Left value, or null to skip
   */
  public tapBoth(
    rightFn?: ((value: R) => void | Promise<void>) | null,
    leftFn?: ((error: L) => void | Promise<void>) | null,
  ): AsyncEither<L, R> {
    return this.chain(async (either) => {
      if (either.isRight() && rightFn) {
        await this.tap(rightFn);
      } else if (either.isLeft() && leftFn) {
        await this.tapError(leftFn);
      }

      return either;
    });
  }

  /**
   * Extracts the Right value or rejects with the Left value.
   */
  public async orThrow(): Promise<R> {
    return this.unwrapOrThrow();
  }

  /**
   * Extracts the Right value or rejects with the Left value.
   * This is different from awaiting and calling `unwrap`, which throws
   * `EitherUnwrapError`.
   */
  public async unwrapOrThrow(): Promise<R> {
    const either = await this.promise;
    return either.unwrapOrThrow();
  }

  /**
   * Resolves to whether this AsyncEither is a Right.
   * The boolean does not narrow. Await this AsyncEither and use
   * `Either.isRight` when the type needs to narrow.
   */
  public async isRight(): Promise<boolean> {
    const either = await this.promise;
    return either.isRight();
  }

  /**
   * Resolves to whether this AsyncEither is a Left.
   * The boolean does not narrow. Await this AsyncEither and use
   * `Either.isLeft` when the type needs to narrow.
   */
  public async isLeft(): Promise<boolean> {
    const either = await this.promise;
    return either.isLeft();
  }

  /**
   * Converts this AsyncEither to a discriminated result object.
   */
  public async toResult(): Promise<
    { success: true; value: R } | { success: false; error: L }
  > {
    const eitherInstance = await this.promise;
    return eitherInstance.toResult();
  }

  /**
   * Chains a transformation. Callback exceptions reject the result.
   */
  private chain<NextL, NextR>(
    transform: (
      either: Either<L, R>,
    ) => Either<NextL, NextR> | Promise<Either<NextL, NextR>>,
  ): AsyncEither<NextL, NextR> {
    return AsyncEither.adopt(this.promise.then(transform));
  }
}

/**
 * Creates a new AsyncEither with a Right value.
 *
 * @param value The value to wrap in a Right
 */
export const asyncRight = <L, R>(value: R): AsyncEither<L, R> => {
  return AsyncEither.fromEither(right(value));
};

/**
 * Creates a new AsyncEither with a Left value.
 *
 * @param error The error to wrap in a Left
 */
export const asyncLeft = <L, R>(error: L): AsyncEither<L, R> => {
  return AsyncEither.fromEither(left(error));
};
