import { EitherUnwrapError } from '../errors';
import { Either } from './either';
import type { Right } from './right';

export class Left<L, R> extends Either<L, R> {
  constructor(protected readonly error: L) {
    super();
  }

  public map<T>(): Either<L, T> {
    return new Left(this.error);
  }

  public mapError<T>(fn: (err: L) => T): Either<T, R> {
    return new Left(fn(this.error));
  }

  public filter<E, S extends R>(
    predicate: (value: R) => value is S,
    errorFactory: (value: R) => E,
  ): Either<L | E, S>;

  public filter<E>(
    predicate: (value: R) => boolean,
    errorFactory: (value: R) => E,
  ): Either<L | E, R>;

  public filter<E, S extends R>(): Either<L | E, R | S> {
    return new Left(this.error);
  }

  public flatMap<U, T>(): Either<U | L, T> {
    return new Left<U | L, T>(this.error);
  }

  public getOrElse(defaultValue: R): R {
    return defaultValue;
  }

  public getErrorOrElse(): L {
    return this.error;
  }

  public isRight(): this is Right<L, R> {
    return false;
  }

  public isLeft(): this is Left<L, R> {
    return true;
  }

  public unwrap(): R {
    throw new EitherUnwrapError('Cannot unwrap Left instance');
  }

  public unwrapError(): L {
    return this.error;
  }

  public tap(): Either<L, R> {
    return this;
  }

  public tapError(fn: (error: L) => void): Either<L, R> {
    try {
      fn(this.error);
    } catch (error) {
      console.log('[Either/Left] Error on tapError');
      console.error(error);
    }

    return this;
  }

  public tapBoth(
    rightFn: ((value: R) => void) | null,
    leftFn: ((error: L) => void) | null,
  ): Either<L, R> {
    if (leftFn) return this.tapError(leftFn);
    return this;
  }

  public toResult(): { success: false; error: L } {
    return { success: false, error: this.error };
  }
}

export const left = <L, R>(error: L): Either<L, R> => new Left<L, R>(error);
