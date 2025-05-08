import { Either, left, right } from '../either';

/**
 * An asynchronous version of Either that wraps a Promise of an Either.
 * Provides a way to work with Either in asynchronous contexts.
 * Implements the Promise interface for compatibility with Promise-based APIs.
 *
 * @template L The type of the Left value (usually an error)
 * @template R The type of the Right value (usually the success value)
 */
export class AsyncEither<L, R> implements Promise<Either<L, R>> {
  private readonly promise: Promise<Either<L, R>>;

  /**
   * Creates a new AsyncEither from a Promise or an Either.
   *
   * @param promiseOrEither A Promise that resolves to a value, an Either, or an Either instance
   */
  constructor(promiseOrEither: Promise<R | Either<L, R>> | Either<L, R>) {
    this.promise = Promise.resolve(promiseOrEither)
      .then((result) => {
        if (result instanceof Either) return result;
        return right<L, R>(result);
      })
      .catch((error) => left<L, R>(error));
  }

  /**
   * Creates an AsyncEither from a Promise that might throw.
   * If the Promise resolves, the result will be a Right.
   * If the Promise rejects, the error will be a Left.
   *
   * @template L The type of the Left value
   * @template R The type of the Right value
   * @param promise A Promise that might throw
   * @returns An AsyncEither that will resolve to Either
   */
  public static tryCatch<L, R>(promise: Promise<R>): AsyncEither<L, R> {
    return new AsyncEither(promise);
  }

  /**
   * Creates an AsyncEither from a Promise with Error as the default Left type.
   *
   * @template R The type of the Right value
   * @template L The type of the Left value, defaults to Error
   * @param promise A Promise to wrap
   * @returns An AsyncEither that will resolve to Either
   */
  public static fromPromise<R, L = Error>(
    promise: Promise<R>,
  ): AsyncEither<L, R> {
    return AsyncEither.tryCatch(promise);
  }

  /**
   * Creates an AsyncEither from an Either.
   *
   * @template L The type of the Left value
   * @template R The type of the Right value
   * @param either An Either to wrap
   * @returns An AsyncEither that will resolve to the given Either
   */
  public static fromEither<L, R>(either: Either<L, R>): AsyncEither<L, R> {
    return new AsyncEither(either);
  }

  /**
   * Implementation of the Promise interface's Symbol.toStringTag.
   *
   * @returns The string tag for this object
   */
  public get [Symbol.toStringTag]() {
    return 'AsyncEither';
  }

  /**
   * Implementation of the Promise interface's then method.
   *
   * @template TResult1 The type of the fulfilled value
   * @template TResult2 The type of the rejected value
   * @param onfulfilled The callback to execute when the Promise is resolved
   * @param onrejected The callback to execute when the Promise is rejected
   * @returns A Promise for the completion of which ever callback is executed
   */
  public then<TResult1 = Either<L, R>, TResult2 = never>(
    onfulfilled?:
      | ((value: Either<L, R>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  /**
   * Implementation of the Promise interface's catch method.
   *
   * @template TResult The type of the value to return on rejection
   * @param onrejected The callback to execute when the Promise is rejected
   * @returns A Promise for the completion of the callback
   */
  public catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<Either<L, R> | TResult> {
    return this.promise.catch(onrejected);
  }

  /**
   * Transforms the Right value of this AsyncEither with a given function.
   * If this is a Left, returns a new AsyncEither with the same error value.
   * Supports both synchronous and asynchronous mapping functions.
   *
   * @template T The result type after mapping
   * @param fn A function to apply to the Right value
   * @returns A new AsyncEither with the mapped Right value or the same Left value
   */
  public map<T>(fn: (value: R) => T | Promise<T>): AsyncEither<L, T> {
    return this.chain(async (either) => {
      if (either.isLeft()) return left<L, T>(either.unwrapError());
      const mappedValue = await fn(either.unwrap());
      return right<L, T>(mappedValue);
    });
  }

  /**
   * Maps the Right value and flattens the resulting Either or AsyncEither.
   * If this is a Left, returns a new AsyncEither with the same error.
   * Supports both synchronous and asynchronous mapping functions.
   *
   * @template U The new Left type
   * @template T The new Right type
   * @param fn A function that returns a new Either, Promise<Either>, or AsyncEither
   * @returns A new AsyncEither that is the result of applying and flattening
   */
  public flatMap<U, T>(
    fn: (value: R) => Either<U, T> | Promise<Either<U, T>> | AsyncEither<U, T>,
  ): AsyncEither<L | U, T> {
    return this.chain(async (either) => {
      if (either.isLeft()) return left<L | U, T>(either.unwrapError());

      const result = await fn(either.unwrap());
      if (result instanceof AsyncEither) {
        return result.promise;
      }
      return result;
    });
  }

  /**
   * Transforms the Left value of this AsyncEither with a given function.
   * If this is a Right, returns a new AsyncEither with the same value.
   * Supports both synchronous and asynchronous mapping functions.
   *
   * @template U The new error type
   * @param fn A function to apply to the Left value
   * @returns A new AsyncEither with the mapped Left value or the same Right value
   */
  public mapError<U>(fn: (error: L) => U | Promise<U>): AsyncEither<U, R> {
    return this.chain(async (either) => {
      if (either.isRight()) return right<U, R>(either.unwrap());
      const mappedError = await fn(either.unwrapError());
      return left<U, R>(mappedError);
    });
  }

  /**
   * Attempts to recover from a Left by applying a function that returns a new AsyncEither.
   * If this is a Right, returns a new AsyncEither with the same value.
   *
   * @template U The new error type to potentially add
   * @param fn A function that takes a Left Either and returns a new AsyncEither
   * @returns A new AsyncEither that might have recovered from the Left
   */
  public recover<U>(fn: (left: Either<L, R>) => AsyncEither<L | U, R>) {
    return this.chain(async (either) => {
      if (either.isRight()) return right<L | U, R>(either.unwrap());

      const result = await fn(either);
      if (result instanceof AsyncEither) {
        return result.promise;
      }
      return result;
    });
  }

  /**
   * Extracts the Right value or returns the provided default value if this is a Left.
   * Supports both synchronous and asynchronous default value functions.
   *
   * @param defaultValue The default value to return if this is a Left, or a function that returns it
   * @returns A Promise that resolves to the Right value or the default value
   */
  public async getOrElse(defaultValue: R | (() => Promise<R> | R)): Promise<R> {
    const either = await this.promise;
    if (either.isRight()) {
      return either.unwrap();
    }
    return defaultValue instanceof Function ? defaultValue() : defaultValue;
  }

  /**
   * Extracts the Left value or returns the provided default error if this is a Right.
   * Supports both synchronous and asynchronous default error functions.
   *
   * @param defaultError The default error to return if this is a Right, or a function that returns it
   * @returns A Promise that resolves to the Left value or the default error
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
   * Performs a side-effect on the Right value without changing the AsyncEither.
   * If this is a Left, does nothing.
   * Supports both synchronous and asynchronous side-effect functions.
   *
   * @param fn A function to execute on the Right value
   * @returns This AsyncEither unchanged
   */
  public tap(fn: (value: R) => void | Promise<void>): AsyncEither<L, R> {
    return this.chain(async (either) => {
      if (!either.isRight()) return either;
      try {
        await fn(either.unwrap());
      } catch (error) {
        console.error('An error occurred at tap', error);
      }
      return either;
    });
  }

  /**
   * Performs a side-effect on the Left value without changing the AsyncEither.
   * If this is a Right, does nothing.
   * Supports both synchronous and asynchronous side-effect functions.
   *
   * @param fn A function to execute on the Left value
   * @returns This AsyncEither unchanged
   */
  public tapError(fn: (error: L) => void | Promise<void>): AsyncEither<L, R> {
    return this.chain(async (either) => {
      if (!either.isLeft()) return either;
      try {
        await fn(either.unwrapError());
      } catch (error) {
        console.error('An error occurred at tapError', error);
      }
      return either;
    });
  }

  /**
   * Performs a side-effect on either the Right or Left value without changing the AsyncEither.
   * Supports both synchronous and asynchronous side-effect functions.
   *
   * @param rightFn A function to execute on the Right value
   * @param leftFn A function to execute on the Left value
   * @returns This AsyncEither unchanged
   */
  public tapBoth(
    rightFn?: ((value: R) => void | Promise<void>) | null,
    leftFn?: ((error: L) => void | Promise<void>) | null,
  ): AsyncEither<L, R> {
    return new AsyncEither(
      this.promise.then(async (either) => {
        if (either.isRight() && !!rightFn) {
          await this.tap(rightFn);
        } else if (either.isLeft() && !!leftFn) {
          await this.tapError(leftFn);
        }

        return either;
      }),
    );
  }

  /**
   * Checks if this AsyncEither will resolve to a Right.
   *
   * @returns A Promise that resolves to true if this is a Right, false otherwise
   */
  public async isRight(): Promise<boolean> {
    const either = await this.promise;
    return either.isRight();
  }

  /**
   * Checks if this AsyncEither will resolve to a Left.
   *
   * @returns A Promise that resolves to true if this is a Left, false otherwise
   */
  public async isLeft(): Promise<boolean> {
    const either = await this.promise;
    return either.isLeft();
  }

  /**
   * Converts this AsyncEither to a result object.
   *
   * @returns A Promise that resolves to an object with a success flag and either a value or an error
   */
  public async toResult(): Promise<
    { success: true; value: R } | { success: false; error: L }
  > {
    const eitherInstance = await this.promise;
    return eitherInstance.toResult();
  }

  /**
   * Internal method to chain transformations on this AsyncEither.
   *
   * @template NextL The new Left type
   * @template NextR The new Right type
   * @param transform A function that transforms an Either to another Either or Promise<Either>
   * @returns A new AsyncEither with the transformed value
   * @private
   */
  private chain<NextL, NextR>(
    transform: (
      either: Either<L, R>,
    ) => Either<NextL, NextR> | Promise<Either<NextL, NextR>>,
  ): AsyncEither<NextL, NextR> {
    const newPromiseResolvingToEither = this.promise.then(transform);
    return new AsyncEither(newPromiseResolvingToEither);
  }
}

/**
 * Creates a new AsyncEither with a Right value.
 *
 * @template L The type of the Left value
 * @template R The type of the Right value
 * @param value The value to wrap in a Right
 * @returns A new AsyncEither containing a Right with the given value
 */
export const asyncRight = <L, R>(value: R): AsyncEither<L, R> => {
  return AsyncEither.fromEither(right(value));
};

/**
 * Creates a new AsyncEither with a Left value.
 *
 * @template L The type of the Left value
 * @template R The type of the Right value
 * @param error The error to wrap in a Left
 * @returns A new AsyncEither containing a Left with the given error
 */
export const asyncLeft = <L, R>(error: L): AsyncEither<L, R> => {
  return AsyncEither.fromEither(left(error));
};
