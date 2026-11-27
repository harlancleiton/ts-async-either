import { faker } from '@faker-js/faker';
import { AsyncEither, asyncLeft, asyncRight } from './async-either';
import { left, right } from '../either';
import { AsyncEitherSettledError } from '../errors';

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
      const observed = (await sut.map(() => 'unused')).unwrapError();

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

  describe('rejection mapping', () => {
    it('should map a rejection with tryCatch', async () => {
      const sut = AsyncEither.tryCatch(Promise.reject('nope'), (error) => ({
        reason: String(error),
      }));
      const observed = await sut;

      expect(observed.isLeft()).toBe(true);
      if (observed.isLeft()) {
        expect(observed.unwrapError()).toEqual({ reason: 'nope' });
      }
    });

    it('should not call the tryCatch mapper when the promise fulfills', async () => {
      const mapError = vi.fn((error: unknown) => String(error));
      const sut = AsyncEither.tryCatch(Promise.resolve('ok'), mapError);

      expect((await sut).unwrap()).toBe('ok');
      expect(mapError).not.toHaveBeenCalled();
    });

    it('should reject when the tryCatch mapper throws', async () => {
      const sut = AsyncEither.tryCatch(Promise.reject('x'), () => {
        throw new Error('mapper bug');
      });

      await expect(sut).rejects.toThrow('mapper bug');
    });

    it('should keep the legacy tryCatch assertion when no mapper is given', async () => {
      const error = new Error('legacy');
      const sut = AsyncEither.tryCatch<Error, string>(Promise.reject(error));

      expect((await sut).unwrapError()).toBe(error);
    });

    it('should map a rejection with fromPromise', async () => {
      const sut = AsyncEither.fromPromise(Promise.reject(404), (error) =>
        Number(error),
      );

      expect((await sut).unwrapError()).toBe(404);
    });

    it('should turn a rejected constructor promise into a Left', async () => {
      const error = new Error('rejected');
      const sut = new AsyncEither<Error, string>(Promise.reject(error));

      expect((await sut).unwrapError()).toBe(error);
    });

    it('should map a constructor rejection and ignore an already settled Either', async () => {
      const rejected = new AsyncEither(Promise.reject('raw'), () => 'mapped');
      const settled = new AsyncEither(left('domain'), () => 'mapped');

      expect((await rejected).unwrapError()).toBe('mapped');
      expect((await settled).unwrapError()).toBe('domain');
    });
  });

  describe('callback exceptions', () => {
    it('should reject when map throws', async () => {
      const sut = asyncRight(1).map(() => {
        throw new Error('bug');
      });

      await expect(sut).rejects.toThrow('bug');
    });

    it('should reject when an async map rejects', async () => {
      const sut = asyncRight(1).map(() =>
        Promise.reject(new Error('async bug')),
      );

      await expect(sut).rejects.toThrow('async bug');
    });

    it('should map an async right value', async () => {
      const observed = await asyncRight(2).map(async (value) => value + 1);

      expect(observed.unwrap()).toBe(3);
    });

    it('should not run map when the value is left', async () => {
      const mapper = vi.fn(() => {
        throw new Error('should not run');
      });
      const observed = await asyncLeft<string, number>('err').map(mapper);

      expect(observed.unwrapError()).toBe('err');
      expect(mapper).not.toHaveBeenCalled();
    });

    it('should reject when flatMap throws', async () => {
      const sut = asyncRight(1).flatMap(() => {
        throw new Error('flat bug');
      });

      await expect(sut).rejects.toThrow('flat bug');
    });

    it('should flatten an AsyncEither and a Promise of Either', async () => {
      const fromAsync = await asyncRight(1).flatMap((value) =>
        asyncRight<string, number>(value + 1),
      );
      const fromPromise = await asyncRight(1).flatMap((value) =>
        Promise.resolve(right<string, number>(value + 2)),
      );
      const failure = await asyncRight(1).flatMap(() =>
        asyncLeft<string, number>('nope'),
      );

      expect(fromAsync.unwrap()).toBe(2);
      expect(fromPromise.unwrap()).toBe(3);
      expect(failure.unwrapError()).toBe('nope');
    });

    it('should reject when mapError throws', async () => {
      await expect(
        asyncLeft<string, number>('err').mapError(() => {
          throw new Error('mapError bug');
        }),
      ).rejects.toThrow('mapError bug');
    });

    it('should map an error asynchronously', async () => {
      const observed = await asyncLeft<string, number>('err').mapError(
        async (error) => error.length,
      );

      expect(observed.unwrapError()).toBe(3);
    });

    it('should recover to a left and reject when recover throws', async () => {
      const recovered = await asyncLeft<string, number>('err').recover(() =>
        asyncLeft<string, number>('still'),
      );

      expect(recovered.unwrapError()).toBe('still');
      await expect(
        asyncLeft<string, number>('err').recover(() => {
          throw new Error('recover bug');
        }),
      ).rejects.toThrow('recover bug');
    });
  });

  describe('filter extras', () => {
    it('should support an async predicate', async () => {
      const kept = await asyncRight(2).filter(
        async (value) => value > 0,
        () => 'bad',
      );
      const rejected = await asyncRight(0).filter(
        async (value) => value > 0,
        () => 'bad',
      );

      expect(kept.unwrap()).toBe(2);
      expect(rejected.unwrapError()).toBe('bad');
    });

    it('should preserve a left and not run the predicate', async () => {
      const predicate = vi.fn(() => true);
      const observed = await asyncLeft<string, number>('err').filter(
        predicate,
        () => 'other',
      );

      expect(observed.unwrapError()).toBe('err');
      expect(predicate).not.toHaveBeenCalled();
    });

    it('should reject when the predicate throws', async () => {
      await expect(
        asyncRight(1).filter(
          () => {
            throw new Error('predicate bug');
          },
          () => 'bad',
        ),
      ).rejects.toThrow('predicate bug');
    });
  });

  describe('defaults', () => {
    it('should call a sync or async getOrElse factory only for left', async () => {
      const syncFactory = vi.fn(() => 'sync');
      const asyncFactory = vi.fn(async () => 'async');
      const skipped = vi.fn(() => 'nope');

      expect(
        await asyncLeft<string, string>('err').getOrElse(syncFactory),
      ).toBe('sync');
      expect(
        await asyncLeft<string, string>('err').getOrElse(asyncFactory),
      ).toBe('async');
      expect(await asyncRight('value').getOrElse(skipped)).toBe('value');
      expect(skipped).not.toHaveBeenCalled();
    });

    it('should await an async getErrorOrElse factory', async () => {
      const observed = await asyncRight<string, number>(1).getErrorOrElse(
        async () => 'computed',
      );

      expect(observed).toBe('computed');
    });
  });

  describe('tap exceptions', () => {
    it('should reject when tap throws and should not log', async () => {
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      const sut = asyncRight('value').tap(() => {
        throw new Error('tap bug');
      });

      await expect(sut).rejects.toThrow('tap bug');
      expect(errorLog).not.toHaveBeenCalled();
      errorLog.mockRestore();
    });

    it('should await an async tap and keep the value', async () => {
      const seen: string[] = [];
      const observed = await asyncRight('value').tap(async (value) => {
        seen.push(value);
      });

      expect(seen).toEqual(['value']);
      expect(observed.unwrap()).toBe('value');
    });

    it('should reject when tapError throws and should not log', async () => {
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      const sut = asyncLeft('err').tapError(() => {
        throw new Error('tapError bug');
      });

      await expect(sut).rejects.toThrow('tapError bug');
      expect(errorLog).not.toHaveBeenCalled();
      errorLog.mockRestore();
    });

    it('should reject when tapBoth throws', async () => {
      await expect(
        asyncRight('value').tapBoth(() => {
          throw new Error('both bug');
        }, null),
      ).rejects.toThrow('both bug');
      await expect(
        asyncLeft('err').tapBoth(null, () => {
          throw new Error('both left bug');
        }),
      ).rejects.toThrow('both left bug');
    });

    it('should skip null callbacks', async () => {
      expect((await asyncRight('value').tapBoth(null, null)).unwrap()).toBe(
        'value',
      );
      expect((await asyncLeft('err').tapBoth(null, null)).unwrapError()).toBe(
        'err',
      );
    });
  });

  describe('orThrow and unwrapOrThrow', () => {
    it('should return the right value', async () => {
      const value = faker.string.sample();
      const sut = asyncRight<string, string>(value);

      expect(await sut.orThrow()).toBe(value);
      expect(await sut.unwrapOrThrow()).toBe(value);
    });

    it('should reject with the left value', async () => {
      const error = new Error(faker.string.sample());
      const sut = asyncLeft<Error, string>(error);

      await expect(sut.orThrow()).rejects.toBe(error);
      await expect(sut.unwrapOrThrow()).rejects.toBe(error);
    });
  });

  describe('all', () => {
    it('should combine right values in order', async () => {
      const result = await AsyncEither.all([
        asyncRight<string, number>(1),
        asyncRight<string, string>('a'),
      ]);

      expect(result.unwrap()).toEqual([1, 'a']);
    });

    it('should fail fast with the first left', async () => {
      let settled = false;
      const slow = new AsyncEither<string, number>(
        new Promise((resolve) => {
          setTimeout(() => {
            settled = true;
            resolve(1);
          }, 30);
        }),
      );

      const result = await AsyncEither.all([
        asyncLeft<string, number>('first'),
        slow,
        asyncLeft<string, number>('second'),
      ]);

      expect(result.unwrapError()).toBe('first');
      expect(settled).toBe(false);
    });

    it('should return a right of an empty tuple', async () => {
      const result = await AsyncEither.all([]);

      expect(result.unwrap()).toEqual([]);
    });

    it('should propagate a callback bug instead of making it a Left', async () => {
      const broken = asyncRight<string, number>(1).map(() => {
        throw new Error('bug');
      });

      await expect(AsyncEither.all([broken])).rejects.toThrow('bug');
    });
  });

  describe('fromMany', () => {
    it('should combine every success', async () => {
      const result = await AsyncEither.fromMany([
        asyncRight<string, number>(1),
        asyncRight<string, string>('a'),
      ]);

      expect(result.unwrap()).toEqual([1, 'a']);
    });

    it('should return a single error directly', async () => {
      const result = await AsyncEither.fromMany([
        asyncRight<string, number>(1),
        asyncLeft<string, number>('only'),
        asyncRight<string, number>(3),
      ]);

      expect(result.unwrapError()).toBe('only');
    });

    it('should aggregate multiple errors', async () => {
      const first = new Error('one');
      const second = new Error('two');
      const result = await AsyncEither.fromMany([
        asyncLeft<Error, number>(first),
        asyncRight<Error, number>(1),
        asyncLeft<Error, number>(second),
      ]);
      const error = result.unwrapError();

      expect(error).toBeInstanceOf(AsyncEitherSettledError);
      if (error instanceof AsyncEitherSettledError) {
        expect(error.errors).toEqual([first, second]);
        expect(error.message).toBe('Multiple errors occurred');
      }
    });

    it('should return a right of an empty list', async () => {
      const result = await AsyncEither.fromMany([]);

      expect(result.unwrap()).toEqual([]);
    });

    it('should propagate a callback bug', async () => {
      const broken = asyncRight(1).map(() => {
        throw new Error('bug');
      });

      await expect(
        AsyncEither.fromMany([asyncRight(1), broken]),
      ).rejects.toThrow('bug');
    });
  });

  describe('allSettled', () => {
    it('should keep each result independent', async () => {
      const [rightValue, promised, leftValue, rejected] =
        AsyncEither.allSettled([
          asyncRight<string, number>(1),
          Promise.resolve(true),
          asyncLeft<string, number>('err'),
          Promise.reject(new Error('rejected')),
        ]);

      expect((await rightValue).unwrap()).toBe(1);
      expect((await promised).unwrap()).toBe(true);
      expect((await leftValue).unwrapError()).toBe('err');
      expect((await rejected).unwrapError()).toEqual(new Error('rejected'));
    });
  });

  describe('promise interface', () => {
    it('should expose AsyncEither as its string tag', () => {
      expect(Object.prototype.toString.call(asyncRight(1))).toBe(
        '[object AsyncEither]',
      );
    });

    it('should resolve then with the Either and not reject a Left', async () => {
      const either = await asyncLeft('err').then((value) => value);

      expect(either.unwrapError()).toBe('err');
      await expect(
        asyncLeft('err').catch(() => {
          throw new Error('should not reject');
        }),
      ).resolves.toEqual(left('err'));
    });

    it('should run finally for success and rejection', async () => {
      const onSuccess = vi.fn();
      const onFailure = vi.fn();

      const success = await asyncRight(1).finally(onSuccess);
      expect(success.unwrap()).toBe(1);
      expect(onSuccess).toHaveBeenCalledOnce();

      await expect(
        asyncRight(1)
          .map(() => {
            throw new Error('bug');
          })
          .finally(onFailure),
      ).rejects.toThrow('bug');
      expect(onFailure).toHaveBeenCalledOnce();
    });

    it('should forward a rejection to catch', async () => {
      const observed = await asyncRight(1)
        .map(() => {
          throw new Error('bug');
        })
        .catch((reason: unknown) => reason);

      expect(observed).toEqual(new Error('bug'));
    });
  });
});
