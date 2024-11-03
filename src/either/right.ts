import { EitherUnwrapError } from '../errors';
import { Either } from './either';
import { Left } from './left';

export class Right<L, R> extends Either<L, R> {
  constructor(protected readonly value: R) {
    super();
  }

  public map<T>(mapper: (value: R) => T): Either<L, T> {
    return new Right(mapper(this.value));
  }

  public mapError<T>(): Either<T, R> {
    return new Right(this.value);
  }

  public filter<E, S extends R>(
    predicate: (value: R) => value is S,
    errorFactory: (value: R) => E,
  ): Either<L | E, S>;

  public filter<E>(
    predicate: (value: R) => boolean,
    errorFactory: (value: R) => E,
  ): Either<L | E, R>;

  public filter<E, S extends R>(
    predicate: ((value: R) => value is S) | ((value: R) => boolean),
    errorFactory: (value: R) => E,
  ): Either<L | E, R | S> {
    return predicate(this.value)
      ? new Right(this.value)
      : new Left(errorFactory(this.value));
  }

  public flatMap<U, T>(mapper: (value: R) => Either<U, T>): Either<U | L, T> {
    return mapper(this.value);
  }

  public getOrElse(): R {
    return this.value;
  }

  public getErrorOrElse(defaultError: L): L {
    return defaultError;
  }

  public isRight(): this is Right<L, R> {
    return true;
  }

  public isLeft(): this is Left<L, R> {
    return false;
  }

  public unwrap(): R {
    return this.value;
  }

  public unwrapError(): L {
    throw new EitherUnwrapError('Cannot unwrapError Right instance');
  }

  public unwrapOrThrow(): R {
    return this.value;
  }
}

export const right = <L, R>(value: R): Either<L, R> => new Right<L, R>(value);
