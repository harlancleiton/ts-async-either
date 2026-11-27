import { expectTypeOf } from 'vitest';
import { AsyncEitherSettledError } from './errors';
import {
  AsyncEither,
  Either,
  Left,
  Right,
  asyncLeft,
  asyncRight,
  left,
  right,
} from './index';

describe('package entry', () => {
  it('should export the sync and async APIs', () => {
    expect(AsyncEither).toBeTypeOf('function');
    expect(asyncLeft).toBeTypeOf('function');
    expect(asyncRight).toBeTypeOf('function');
    expect(left).toBeTypeOf('function');
    expect(right).toBeTypeOf('function');
    expect(new Left('err')).toBeInstanceOf(Either);
    expect(new Right(1)).toBeInstanceOf(Either);
    expect(AsyncEitherSettledError).toBeTypeOf('function');
  });
});

describe('type contracts', () => {
  it('should narrow a synchronous Either', () => {
    const either = right<string, number>(1) as Either<string, number>;
    expectTypeOf(either).toEqualTypeOf<Either<string, number>>();

    if (either.isRight()) {
      expectTypeOf(either).toEqualTypeOf<Right<string, number>>();
      expectTypeOf(either.unwrap()).toBeNumber();
    }
    if (either.isLeft()) {
      expectTypeOf(either).toEqualTypeOf<Left<string, number>>();
      expectTypeOf(either.unwrapError()).toBeString();
    }
  });

  it('should type toResult as a discriminated union', () => {
    const result = left<string, number>('err').toResult();

    if (result.success) {
      expectTypeOf(result.value).toBeNumber();
    } else {
      expectTypeOf(result.error).toBeString();
    }
  });

  it('should type the tryCatch mapper and keep the legacy overload', () => {
    const mapped = AsyncEither.tryCatch(Promise.resolve(1), (error: unknown) =>
      error instanceof Error ? error.message : 'unknown',
    );
    const legacy = AsyncEither.tryCatch<Error, number>(Promise.resolve(1));

    expectTypeOf(mapped).toEqualTypeOf<AsyncEither<string, number>>();
    expectTypeOf(legacy).toEqualTypeOf<AsyncEither<Error, number>>();
  });

  it('should type fromPromise with R then L', () => {
    const mapped = AsyncEither.fromPromise(Promise.resolve(1), () => 'err');
    const legacy = AsyncEither.fromPromise<number>(Promise.resolve(1));

    expectTypeOf(mapped).toEqualTypeOf<AsyncEither<string, number>>();
    expectTypeOf(legacy).toEqualTypeOf<AsyncEither<Error, number>>();
  });

  it('should type all and fromMany as tuples', () => {
    const combined = AsyncEither.all([
      asyncRight<string, number>(1),
      asyncRight<'missing', boolean>(true),
    ]);
    const many = AsyncEither.fromMany([
      asyncRight<string, number>(1),
      asyncLeft<string, boolean>('e'),
    ]);

    expectTypeOf(combined).toEqualTypeOf<
      AsyncEither<string | 'missing', [number, boolean]>
    >();
    expectTypeOf(many).toEqualTypeOf<
      AsyncEither<string | AsyncEitherSettledError, [number, boolean]>
    >();
  });

  it('should type allSettled element by element', () => {
    const [either, promised] = AsyncEither.allSettled([
      asyncRight<string, number>(1),
      Promise.resolve(true),
    ]);

    expectTypeOf(either).toEqualTypeOf<AsyncEither<string, number>>();
    expectTypeOf(promised).toEqualTypeOf<AsyncEither<unknown, boolean>>();
  });

  it('should type async guards as booleans and narrow after await', async () => {
    const asyncEither = asyncRight<string, number>(1);
    expectTypeOf(asyncEither.isRight()).toEqualTypeOf<Promise<boolean>>();
    expectTypeOf(asyncEither.isLeft()).toEqualTypeOf<Promise<boolean>>();

    const either = await asyncEither;
    if (either.isRight()) {
      expectTypeOf(either.unwrap()).toBeNumber();
    }

    const result = await asyncEither.toResult();
    if (result.success) {
      expectTypeOf(result.value).toBeNumber();
    } else {
      expectTypeOf(result.error).toBeString();
    }
  });
});
