import { faker } from '@faker-js/faker';
import { AsyncEither, asyncLeft, asyncRight } from './async-either';
import { left, right } from '../either';

describe('AsyncEither', () => {
  describe('constructor', () => {
    it('should create AsyncEither from promise', async () => {
      const value = faker.string.sample();
      const sut = new AsyncEither(Promise.resolve(value));
      const expected = right(value);
      const observed = await sut;

      expect(observed).toEqual(expected);
    });

    it('should create AsyncEither from Either', async () => {
      const value = faker.string.sample();
      const either = right(value);
      const sut = new AsyncEither(either);
      const expected = right(value);
      const observed = await sut;

      expect(observed).toEqual(expected);
    });
  });

  describe('fromPromise', () => {
    it('fromPromise should wrap a promise into AsyncEither', async () => {
      const value = faker.string.sample();
      const sut = AsyncEither.fromPromise(Promise.resolve(value));
      const observed = await sut;
      expect(observed).toEqual(right(value));
    });
  });

  describe('fromEither', () => {
    it('fromEither should wrap an Either into AsyncEither', async () => {
      const value = faker.string.sample();
      const either = left(value);
      const sut = AsyncEither.fromEither(either);
      const observed = await sut;
      expect(observed).toEqual(left(value));
    });
  });

  describe('tryCatch', () => {
    it('should handle successful promise', async () => {
      const value = faker.string.sample();
      const sut = AsyncEither.tryCatch(Promise.resolve(value));
      const expected = right(value);
      const observed = await sut;

      expect(observed).toEqual(expected);
    });

    it('should handle failed promise', async () => {
      const error = new Error(faker.string.sample());
      const sut = AsyncEither.tryCatch(Promise.reject(error));
      const expected = left(error);
      const observed = await sut;

      expect(observed).toEqual(expected);
    });
  });

  describe('map', () => {
    it('should map right value', async () => {
      const value = faker.number.int();
      const sut = asyncRight(value);
      const expected = right(value.toString()).unwrap();
      const observed = (await sut.map((v) => v.toString())).unwrap();

      expect(observed).toEqual(expected);
    });

    it('should preserve left value', async () => {
      const error = faker.string.sample();
      const sut = asyncLeft(error);
      const expected = left(error).unwrapError();
      const observed = (await sut.map((v: any) => v.toString())).unwrapError();

      expect(observed).toEqual(expected);
    });
  });

  describe('flatMap', () => {
    it('should flatMap right value', async () => {
      const value = faker.number.int();
      const sut = asyncRight(value);
      const expected = right(value.toString()).unwrap();
      const observed = (await sut.flatMap((v) => right(v.toString()))).unwrap();

      expect(observed).toEqual(expected);
    });

    it('should preserve left value', async () => {
      const error = faker.string.sample();
      const sut = asyncLeft(error);
      const expected = left(error).unwrapError();
      const observed = (
        await sut.flatMap(() => right(faker.string.alpha()))
      ).unwrapError();

      expect(observed).toEqual(expected);
    });
  });

  describe('mapError', () => {
    it('should map left error', async () => {
      const err = faker.string.sample();
      const sut = asyncLeft(err).mapError((e) => e.length);
      const observedError = (await sut).unwrapError();

      expect(observedError).toBe(err.length);
    });

    it('should preserve right value and not run mapper', async () => {
      const value = faker.number.int();
      const mockedFn = vi.fn();
      const sut = asyncRight<string, number>(value).mapError(mockedFn);
      const observed = (await sut).unwrap();

      expect(observed).toBe(value);
      expect(mockedFn).not.toHaveBeenCalled();
    });
  });

  describe('recover', () => {
    it('should recover from left to right', async () => {
      const err = 'oops';
      const recoveredValue = 42;
      const sut = asyncLeft<string, number>(err).recover(() =>
        asyncRight<string, number>(recoveredValue),
      );
      const observed = (await sut).unwrap();
      expect(observed).toBe(recoveredValue);
    });

    it('should preserve right value and not call recover fn', async () => {
      const value = 7;
      const spy = vi.fn();
      const sut = asyncRight<string, number>(value).recover(spy);
      const observed = (await sut).unwrap();
      expect(observed).toBe(value);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('filter', () => {
    it('should keep value when predicate is true', async () => {
      const value = faker.number.int();
      const sut = asyncRight(value);
      const expected = right(value).unwrap();
      const observed = (
        await sut.filter(
          () => true,
          () => 'error',
        )
      ).unwrap();

      expect(observed).toEqual(expected);
    });

    it('should return left when predicate is false', async () => {
      const value = faker.number.int();
      const error = faker.string.sample();
      const sut = asyncRight(value);
      const expected = error;
      const observed = (
        await sut.filter(
          () => false,
          () => error,
        )
      ).unwrapError();

      expect(observed).toEqual(expected);
    });
  });

  describe('getOrElse', () => {
    it('should return value for right', async () => {
      const value = faker.string.sample();
      const sut = asyncRight(value);
      const expected = value;
      const observed = await sut.getOrElse('default');

      expect(observed).toBe(expected);
    });

    it('should return default for left', async () => {
      const defaultValue = faker.string.sample();
      const sut = asyncLeft('error');
      const expected = defaultValue;
      const observed = await sut.getOrElse(defaultValue);

      expect(observed).toBe(expected);
    });
  });

  describe('getErrorOrElse', () => {
    it('should return error for left', async () => {
      const err = faker.string.sample();
      const sut = asyncLeft<string, number>(err);
      const observed = await sut.getErrorOrElse('default');
      expect(observed).toBe(err);
    });

    it('should return default for right', async () => {
      const value = faker.number.int();
      const sut = asyncRight<string, number>(value);
      const observed = await sut.getErrorOrElse('default');
      expect(observed).toBe('default');
    });

    it('should accept a function defaultError', async () => {
      const value = faker.number.int();
      const sut = asyncRight<string, number>(value);
      const defaultFn = vi.fn(() => 'computed');
      const observed = await sut.getErrorOrElse(defaultFn);
      expect(observed).toBe('computed');
      expect(defaultFn).toHaveBeenCalled();
    });
  });

  describe('tap', () => {
    it('should execute tap function for right value', async () => {
      const value = faker.string.sample();
      const sut = asyncRight(value);
      const mockedFn = vi.fn();
      await sut.tap(mockedFn);

      expect(mockedFn).toHaveBeenCalledWith(value);
    });

    it('should not execute tap function for left value', async () => {
      const error = faker.string.sample();
      const sut = asyncLeft(error);
      const mockedFn = vi.fn();
      await sut.tap(mockedFn);

      expect(mockedFn).not.toHaveBeenCalled();
    });

    it('should keep value on execute tap function for right value', async () => {
      const value = faker.string.sample();
      const sut = asyncRight(value);

      const expected = value;
      const observed = (await sut).unwrap();

      expect(expected).toBe(observed);
    });
  });

  describe('tapError', () => {
    it('should execute tapError function for left value', async () => {
      const error = faker.string.sample();
      const sut = asyncLeft(error);
      const mockedFn = vi.fn();
      await sut.tapError(mockedFn);

      expect(mockedFn).toHaveBeenCalledWith(error);
    });

    it('should not execute tapError function for right value', async () => {
      const value = faker.string.sample();
      const sut = asyncRight(value);
      const mockedFn = vi.fn();
      await sut.tapError(mockedFn);

      expect(mockedFn).not.toHaveBeenCalled();
    });

    it('should keep error on execute tapError function for left value', async () => {
      const error = faker.string.sample();
      const sut = asyncLeft(error);

      const expected = error;
      const observed = (await sut).unwrapError();

      expect(expected).toBe(observed);
    });
  });

  describe('tapBoth', () => {
    it('should execute tap function for right value and rightFn is defined', async () => {
      const value = faker.string.sample();
      const sut = asyncRight(value);
      const mockedFn = vi.fn();
      vi.spyOn(sut, 'tap');
      await sut.tapBoth(mockedFn, null);

      expect(sut.tap).toHaveBeenCalledWith(mockedFn);
    });

    it('should execute tapError function for left value and leftFn is defined', async () => {
      const error = faker.string.sample();
      const sut = asyncLeft(error);
      const mockedFn = vi.fn();
      vi.spyOn(sut, 'tapError');
      await sut.tapBoth(null, mockedFn);

      expect(sut.tapError).toHaveBeenCalledWith(mockedFn);
    });

    it('should not execute tap function for left value', async () => {
      const error = faker.string.sample();
      const sut = asyncLeft(error);
      const mockedFn = vi.fn();
      vi.spyOn(sut, 'tap');
      await sut.tapBoth(mockedFn, null);

      expect(sut.tap).not.toBeCalled();
    });

    it('should not execute tapError function for right value', async () => {
      const value = faker.string.sample();
      const sut = asyncRight(value);
      const mockedFn = vi.fn();
      vi.spyOn(sut, 'tapError');
      await sut.tapBoth(null, mockedFn);

      expect(sut.tapError).not.toBeCalled();
    });
  });

  describe('isRight', () => {
    it('should return true for right value', async () => {
      const value = faker.string.sample();
      const sut = asyncRight(value);
      const observed = await sut.isRight();

      expect(observed).toBeTruthy();
    });

    it('should return false for left value', async () => {
      const error = faker.string.sample();
      const sut = asyncLeft(error);
      const observed = await sut.isRight();

      expect(observed).toBeFalsy();
    });
  });

  describe('isLeft', () => {
    it('should return false for right value', async () => {
      const value = faker.string.sample();
      const sut = asyncRight(value);
      const observed = await sut.isLeft();

      expect(observed).toBeFalsy();
    });

    it('should return true for left value', async () => {
      const error = faker.string.sample();
      const sut = asyncLeft(error);
      const observed = await sut.isLeft();

      expect(observed).toBeTruthy();
    });
  });

  describe('toResult', () => {
    it('should convert right to success result', async () => {
      const value = faker.string.sample();
      const sut = asyncRight(value);
      const expected = { success: true, value };
      const observed = await sut.toResult();

      expect(observed).toEqual(expected);
    });

    it('should convert left to error result', async () => {
      const error = faker.string.sample();
      const sut = asyncLeft(error);
      const expected = { success: false, error };
      const observed = await sut.toResult();

      expect(observed).toEqual(expected);
    });
  });
});
