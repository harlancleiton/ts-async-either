import { faker } from '@faker-js/faker';
import { Left } from './left';
import { EitherUnwrapError } from '../errors';

describe('Left', () => {
  it('should create a Left instance', () => {
    const error = faker.string.sample();
    const sut = new Left(error);

    expect(sut).toBeInstanceOf(Left);
  });

  it('should return new Left with same error when map is called', () => {
    const error = new Error(faker.string.sample());
    const sut = new Left(error);
    const mapper = (value: number) => value * 2;

    // @ts-expect-error
    const observed = sut.map(mapper);
    const expected = new Left(error);

    expect(observed).toEqual(expected);
  });

  it('should transform error when mapError is called', () => {
    const error = faker.number.int();
    const sut = new Left(error);
    const errorMapper = (err: number) => err.toString();

    const observed = sut.mapError(errorMapper);
    const expected = new Left(error.toString());

    expect(observed).toEqual(expected);
  });

  it('should return new Left with same error when filter is called', () => {
    const error = faker.string.sample();
    const sut = new Left<string, number>(error);
    const predicate = (value: number) => value > 0;
    const errorFactory = (value: number) => `Invalid value: ${value}`;

    const observed = sut.filter(predicate, errorFactory);
    const expected = new Left(error);

    expect(observed).toEqual(expected);
  });

  it('should return new Left with same error when flatMap is called', () => {
    const error = new Error(faker.string.sample());
    const sut = new Left(error);
    const mapper = () => new Left(new Error('new error'));

    // @ts-expect-error
    const observed = sut.flatMap(mapper);
    const expected = new Left(error);

    expect(observed).toEqual(expected);
  });

  it('should return default value when getOrElse is called', () => {
    const error = faker.string.sample();
    const defaultValue = faker.number.int();
    const sut = new Left<string, number>(error);

    const observed = sut.getOrElse(defaultValue);

    expect(observed).toBe(defaultValue);
  });

  it('should return error when getErrorOrElse is called', () => {
    const error = new Error(faker.string.sample());
    const sut = new Left(error);

    // @ts-expect-error
    const observed = sut.getErrorOrElse(new Error(faker.string.sample()));

    expect(observed).toBe(error);
  });

  it('should return false when isRight is called', () => {
    const error = faker.string.sample();
    const sut = new Left(error);

    const observed = sut.isRight();

    expect(observed).toBe(false);
  });

  it('should return true when isLeft is called', () => {
    const error = faker.string.sample();
    const sut = new Left(error);

    const observed = sut.isLeft();

    expect(observed).toBe(true);
  });

  it('should throw EitherUnwrapError when unwrap is called', () => {
    const error = faker.string.sample();
    const sut = new Left(error);

    expect(() => sut.unwrap()).toThrow(
      new EitherUnwrapError('Cannot unwrap Left instance'),
    );
  });

  it('should return error when unwrapError is called', () => {
    const error = faker.string.sample();
    const sut = new Left(error);

    const observed = sut.unwrapError();

    expect(observed).toBe(error);
  });

  it('should return self when tap is called', () => {
    const sut = new Left(faker.string.sample());

    const observed = sut.tap();

    expect(observed).toBe(sut);
  });

  it("shouldn't execute rightFn when tap is called", () => {
    const sut = new Left(faker.string.sample());
    const mockFn = vitest.fn();
    // @ts-expect-error
    sut.tap(mockFn);

    expect(mockFn).not.toHaveBeenCalled();
  });

  it('should execute error function when tapError is called', () => {
    const error = faker.string.sample();
    const sut = new Left(error);
    const mockFn = vitest.fn();

    sut.tapError(mockFn);

    expect(mockFn).toHaveBeenCalledWith(error);
  });

  it('should handle exceptions in tapError without throwing', () => {
    const sut = new Left(faker.string.sample());
    const mockConsoleError = vitest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const mockConsoleLog = vitest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const error = new Error(faker.string.sample());
    const observed = sut.tapError(() => {
      throw error;
    });

    expect(observed).toBe(sut);
    expect(mockConsoleError).toHaveBeenCalledWith(error);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[Either/Left] Error on tapError',
    );
  });

  it('should execute left function when tapBoth is called with leftFn', () => {
    const error = new Error(faker.string.sample());
    const sut = new Left(error);
    const mockLeftFn = vitest.fn();
    const mockRightFn = vitest.fn();

    sut.tapBoth(mockRightFn, mockLeftFn);

    expect(mockLeftFn).toHaveBeenCalledWith(error);
    expect(mockRightFn).not.toHaveBeenCalled();
  });

  it('should return self when tapBoth is called without leftFn', () => {
    const sut = new Left(faker.string.sample());

    const observed = sut.tapBoth(vitest.fn(), null);

    expect(observed).toBe(sut);
  });
});
