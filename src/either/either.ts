import type { Left } from './left';
import type { Right } from './right';

export abstract class Either<L, R> {
  public abstract map<T>(mapper: (value: R) => T): Either<L, T>;

  public abstract mapError<T>(fn: (err: L) => T): Either<T, R>;

  public abstract filter<E, S extends R>(
    predicate: (value: R) => value is S,
    errorFactory: (value: R) => E,
  ): Either<L | E, S>;

  public abstract filter<E>(
    predicate: (value: R) => boolean,
    errorFactory: (value: R) => E,
  ): Either<L | E, R>;

  public abstract flatMap<U, T>(
    mapper: (value: R) => Either<U, T>,
  ): Either<U | L, T>;

  public abstract getOrElse(defaultValue: R): R;

  public abstract getErrorOrElse(defaultError: L): L;

  public abstract isRight(): this is Right<L, R>;

  public abstract isLeft(): this is Left<L, R>;

  public abstract unwrap(): R;

  public abstract unwrapError(): L;

  public abstract tap(fn: (value: R) => void): Either<L, R>;

  public abstract tapError(fn: (error: L) => void): Either<L, R>;

  public abstract tapBoth(
    rightFn: (value: R) => void | null,
    leftFn: (error: L) => void | null,
  ): Either<L, R>;

  public abstract toResult():
    | { success: true; value: R }
    | { success: false; error: L };
}
