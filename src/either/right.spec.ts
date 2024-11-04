import { faker } from '@faker-js/faker';
import { EitherUnwrapError } from '../errors';
import { Left } from './left';
import { Right } from './right';

describe('Right', () => {
  it('should map value correctly', () => {
    const initialValue = faker.string.alpha();
    const mappedValue = faker.number.int();
    const sut = new Right(initialValue);

    const observed = sut.map(() => mappedValue);
    const expected = new Right(mappedValue);

    expect(observed).toEqual(expected);
  });

  it('should keep same value when mapError is called', () => {
    const value = faker.string.alpha();
    const sut = new Right(value);

    // @ts-expect-error
    const observed = sut.mapError(() => faker.string.alpha());
    const expected = new Right(value);

    expect(observed).toEqual(expected);
  });

  it('should return Right when filter predicate is true', () => {
    const value = faker.string.alpha();
    const sut = new Right(value);

    const observed = sut.filter(
      () => true,
      () => faker.string.alpha(),
    );
    const expected = new Right(value);

    expect(observed).toEqual(expected);
  });

  it('should return Left when filter predicate is false', () => {
    const value = faker.string.alpha();
    const errorValue = faker.string.alpha();
    const sut = new Right(value);

    const observed = sut.filter(
      () => false,
      () => errorValue,
    );
    const expected = new Left(errorValue);

    expect(observed).toEqual(expected);
  });

  it('should flatMap to another Either', () => {
    const initialValue = faker.string.alpha();
    const mappedValue = faker.number.int();
    const sut = new Right(initialValue);

    const observed = sut.flatMap(() => new Right(mappedValue));
    const expected = new Right(mappedValue);

    expect(observed).toEqual(expected);
  });

  it('should return value on getOrElse', () => {
    const value = faker.string.alpha();
    const sut = new Right(value);

    // @ts-expect-error
    const observed = sut.getOrElse(faker.string.alpha());
    const expected = value;

    expect(observed).toBe(expected);
  });

  it('should return default error on getErrorOrElse', () => {
    const defaultError = faker.string.alpha();
    const sut = new Right(faker.string.alpha());

    const observed = sut.getErrorOrElse(defaultError);
    const expected = defaultError;

    expect(observed).toBe(expected);
  });

  it('should return true for isRight', () => {
    const sut = new Right(faker.string.alpha());
    expect(sut.isRight()).toBe(true);
  });

  it('should return false for isLeft', () => {
    const sut = new Right(faker.string.alpha());
    expect(sut.isLeft()).toBe(false);
  });

  it('should return value on unwrap', () => {
    const value = faker.string.alpha();
    const sut = new Right(value);

    const observed = sut.unwrap();
    const expected = value;

    expect(observed).toBe(expected);
  });

  it('should throw error on unwrapError', () => {
    const sut = new Right(faker.string.alpha());

    expect(() => sut.unwrapError()).toThrow(EitherUnwrapError);
    expect(() => sut.unwrapError()).toThrow(
      'Cannot unwrapError Right instance',
    );
  });

  it('should return value on unwrapOrThrow', () => {
    const value = faker.string.alpha();
    const sut = new Right(value);

    const observed = sut.unwrapOrThrow();
    const expected = value;

    expect(observed).toBe(expected);
  });

  it('should execute function when tap is called', () => {
    const value = faker.string.sample();
    const sut = new Right(value);
    const mockFn = vitest.fn();

    sut.tap(mockFn);

    expect(mockFn).toHaveBeenCalledWith(value);
  });

  it('should handle exceptions in tap without throwing', () => {
    const sut = new Right(faker.string.sample());
    const mockConsoleError = vitest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const mockConsoleLog = vitest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const error = new Error(faker.string.sample());
    const observed = sut.tap(() => {
      throw error;
    });

    expect(observed).toBe(sut);
    expect(mockConsoleError).toHaveBeenCalledWith(error);
    expect(mockConsoleLog).toHaveBeenCalledWith('[Either/Right] Error on tap');
  });

  it('should return self when tapError is called', () => {
    const sut = new Right(faker.string.sample());

    const observed = sut.tapError();

    expect(observed).toBe(sut);
  });

  it("shouldn't execute leftFn when tapError is called", () => {
    const sut = new Right(faker.string.sample());
    const mockFn = vitest.fn();
    // @ts-expect-error
    sut.tapError(mockFn);

    expect(mockFn).not.toHaveBeenCalled();
  });

  it('should execute right function when tapBoth is called with rightFn', () => {
    const value = faker.string.sample();
    const sut = new Right(value);
    const mockLeftFn = vitest.fn();
    const mockRightFn = vitest.fn();

    // @ts-expect-error
    sut.tapBoth(mockRightFn, mockLeftFn);

    expect(mockLeftFn).not.toHaveBeenCalled();
    expect(mockRightFn).toHaveBeenCalledWith(value);
  });

  it('should return self when tapBoth is called without rightFn', () => {
    const sut = new Right(faker.string.sample());

    const observed = sut.tapBoth(null);

    expect(observed).toBe(sut);
  });
});
