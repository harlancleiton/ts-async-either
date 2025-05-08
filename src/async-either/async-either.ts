import { Either, left, right } from '../either';

export class AsyncEither<L, R> implements Promise<Either<L, R>> {
  private readonly promise: Promise<Either<L, R>>;

  constructor(promiseOrEither: Promise<R | Either<L, R>> | Either<L, R>) {
    this.promise = Promise.resolve(promiseOrEither)
      .then((result) => {
        if (result instanceof Either) return result;
        return right<L, R>(result);
      })
      .catch((error) => left<L, R>(error));
  }

  public static tryCatch<L, R>(promise: Promise<R>): AsyncEither<L, R> {
    return new AsyncEither(promise);
  }

  public static fromPromise<R, L = Error>(
    promise: Promise<R>,
  ): AsyncEither<L, R> {
    return AsyncEither.tryCatch(promise);
  }

  public static fromEither<L, R>(either: Either<L, R>): AsyncEither<L, R> {
    return new AsyncEither(either);
  }

  public get [Symbol.toStringTag]() {
    return 'AsyncEither';
  }

  public then<TResult1 = Either<L, R>, TResult2 = never>(
    onfulfilled?:
      | ((value: Either<L, R>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  public catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<Either<L, R> | TResult> {
    return this.promise.catch(onrejected);
  }

  public map<T>(fn: (value: R) => T | Promise<T>): AsyncEither<L, T> {
    return this.chain(async (either) => {
      if (either.isLeft()) return left<L, T>(either.unwrapError());
      const mappedValue = await fn(either.unwrap());
      return right<L, T>(mappedValue);
    });
  }

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

  public mapError<U>(fn: (error: L) => U | Promise<U>): AsyncEither<U, R> {
    return this.chain(async (either) => {
      if (either.isRight()) return right<U, R>(either.unwrap());
      const mappedError = await fn(either.unwrapError());
      return left<U, R>(mappedError);
    });
  }

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

  public filter<E, S extends R>(
    predicate: (value: R) => value is S,
    errorFactory: (value: R) => E,
  ): AsyncEither<L | E, S>;

  public filter<E>(
    predicate: (value: R) => boolean | Promise<boolean>,
    errorFactory: (value: R) => E,
  ): AsyncEither<L | E, R>;

  public filter<E, S extends R>(
    predicate:
      | ((value: R) => value is S)
      | ((value: R) => boolean | Promise<boolean>),
    errorFactory: (value: R) => E,
  ): AsyncEither<L | E, R | S> {
    return this.chain(async (either) => {
      if (either.isLeft()) {
        return left<L | E, R | S>(either.unwrapError());
      }

      const value = either.unwrap();
      const predicateResult = await predicate(value);

      return predicateResult
        ? right<L | E, R | S>(value)
        : left<L | E, R | S>(errorFactory(value));
    });
  }

  public async getOrElse(defaultValue: R | (() => Promise<R> | R)): Promise<R> {
    const either = await this.promise;
    if (either.isRight()) {
      return either.unwrap();
    }
    return defaultValue instanceof Function ? defaultValue() : defaultValue;
  }

  public async getErrorOrElse(
    defaultError: L | (() => Promise<L> | L),
  ): Promise<L> {
    const either = await this.promise;
    if (either.isLeft()) {
      return either.unwrapError();
    }
    return defaultError instanceof Function ? defaultError() : defaultError;
  }

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

  public async isRight(): Promise<boolean> {
    const either = await this.promise;
    return either.isRight();
  }

  public async isLeft(): Promise<boolean> {
    const either = await this.promise;
    return either.isLeft();
  }

  public async toResult(): Promise<
    { success: true; value: R } | { success: false; error: L }
  > {
    const either = await this.promise;
    return either.isRight()
      ? { success: true, value: either.unwrap() }
      : { success: false, error: either.unwrapError() };
  }

  private chain<NextL, NextR>(
    transform: (
      either: Either<L, R>,
    ) => Either<NextL, NextR> | Promise<Either<NextL, NextR>>,
  ): AsyncEither<NextL, NextR> {
    const newPromiseResolvingToEither = this.promise.then(transform);
    return new AsyncEither(newPromiseResolvingToEither);
  }
}

export const asyncRight = <L, R>(value: R): AsyncEither<L, R> => {
  return AsyncEither.fromEither(right(value));
};

export const asyncLeft = <L, R>(error: L): AsyncEither<L, R> => {
  return AsyncEither.fromEither(left(error));
};
