import type { Left } from './left';
import type { Right } from './right';

/**
 * Represents a value of one of two possible types (a disjoint union).
 * An Either is either a Left (typically representing a failure) or a Right (typically representing a success).
 *
 * @template L The type of the Left value (usually an error)
 * @template R The type of the Right value (usually the success value)
 */
export abstract class Either<L, R> {
  /**
   * Transforms the Right value of this Either with a given function.
   * If this is a Left, returns a new Left with the same error value.
   *
   * @template T The result type after mapping
   * @param mapper A function to apply to the Right value
   * @returns A new Either with the mapped Right value or the same Left value
   */
  public abstract map<T>(mapper: (value: R) => T): Either<L, T>;

  /**
   * Transforms the Left value of this Either with a given function.
   * If this is a Right, returns a new Right with the same value.
   *
   * @template T The new error type
   * @param fn A function to apply to the Left value
   * @returns A new Either with the mapped Left value or the same Right value
   */
  public abstract mapError<T>(fn: (err: L) => T): Either<T, R>;

  /**
   * Converts a Right to a Left if the predicate fails.
   * If this is already a Left, returns a new Left with the same error.
   * Provides type narrowing with type predicates.
   *
   * @template E The new error type
   * @template S A subset type of R
   * @param predicate A type predicate function to test the Right value
   * @param errorFactory A function to create an error if the predicate fails
   * @returns A new Either with narrowed type or converted to Left
   */
  public abstract filter<E, S extends R>(
    predicate: (value: R) => value is S,
    errorFactory: (value: R) => E,
  ): Either<L | E, S>;

  /**
   * Converts a Right to a Left if the predicate fails.
   * If this is already a Left, returns a new Left with the same error.
   *
   * @template E The new error type
   * @param predicate A boolean function to test the Right value
   * @param errorFactory A function to create an error if the predicate fails
   * @returns A new Either unchanged or converted to Left
   */
  public abstract filter<E>(
    predicate: (value: R) => boolean,
    errorFactory: (value: R) => E,
  ): Either<L | E, R>;

  /**
   * Maps the Right value and flattens the resulting Either.
   * If this is a Left, returns a new Left with the same error.
   *
   * @template U The new Left type
   * @template T The new Right type
   * @param mapper A function that returns a new Either
   * @returns A new Either that is the result of applying and flattening
   */
  public abstract flatMap<U, T>(
    mapper: (value: R) => Either<U, T>,
  ): Either<U | L, T>;

  /**
   * Extracts the Right value or returns the provided default value if this is a Left.
   *
   * @param defaultValue The default value to return if this is a Left
   * @returns The Right value or the default value
   */
  public abstract getOrElse(defaultValue: R): R;

  /**
   * Extracts the Left value or returns the provided default error if this is a Right.
   *
   * @param defaultError The default error to return if this is a Right
   * @returns The Left value or the default error
   */
  public abstract getErrorOrElse(defaultError: L): L;

  /**
   * Checks if this Either is a Right.
   *
   * @returns true if this is a Right, false otherwise
   */
  public abstract isRight(): this is Right<L, R>;

  /**
   * Checks if this Either is a Left.
   *
   * @returns true if this is a Left, false otherwise
   */
  public abstract isLeft(): this is Left<L, R>;

  /**
   * Extracts the Right value.
   *
   * @returns The Right value
   * @throws {EitherUnwrapError} If this is a Left
   */
  public abstract unwrap(): R;

  /**
   * Extracts the Left value.
   *
   * @returns The Left value
   * @throws {EitherUnwrapError} If this is a Right
   */
  public abstract unwrapError(): L;

  /**
   * Performs a side-effect on the Right value without changing the Either.
   * If this is a Left, does nothing.
   *
   * @param fn A function to execute on the Right value
   * @returns This Either unchanged
   */
  public abstract tap(fn: (value: R) => void): Either<L, R>;

  /**
   * Performs a side-effect on the Left value without changing the Either.
   * If this is a Right, does nothing.
   *
   * @param fn A function to execute on the Left value
   * @returns This Either unchanged
   */
  public abstract tapError(fn: (error: L) => void): Either<L, R>;

  /**
   * Performs a side-effect on either the Right or Left value without changing the Either.
   *
   * @param rightFn A function to execute on the Right value
   * @param leftFn A function to execute on the Left value
   * @returns This Either unchanged
   */
  public abstract tapBoth(
    rightFn: (value: R) => void | null,
    leftFn: (error: L) => void | null,
  ): Either<L, R>;

  /**
   * Converts this Either to a result object.
   *
   * @returns An object with a success flag and either a value or an error
   */
  public abstract toResult():
    | { success: true; value: R }
    | { success: false; error: L };
}
