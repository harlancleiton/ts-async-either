# ts-either

A TypeScript library implementing the Either monad for elegant error handling with strong type safety. It provides both synchronous and asynchronous interfaces to handle operations that might succeed or fail.

## Installation

```bash
pnpm add ts-either
```

or

```bash
yarn add ts-either
```

or

```bash
npm install ts-either
```

## Core Concepts

The Either monad represents a value that is either:

- A "Left" value (typically representing an error)
- A "Right" value (typically representing a successful result)

This approach encourages:

- Explicit error handling
- Type-safe operations
- Functional composition
- No try/catch clutter

## Basic Usage

### Creating Either values

```typescript
import { Either, left, right } from 'ts-either';

// Success case
const successResult: Either<Error, number> = right(42);

// Error case
const errorResult: Either<Error, number> = left(
  new Error('Something went wrong'),
);
```

### Working with Either

```typescript
// Map transforms the right value
const doubled = successResult.map((value) => value * 2); // Either<Error, 84>

// FlatMap (chain) for operations that might fail
const safelyDivide = (n: number, divisor: number): Either<Error, number> => {
  if (divisor === 0) {
    return left(new Error('Division by zero'));
  }
  return right(n / divisor);
};

const result = successResult.flatMap((value) => safelyDivide(value, 2)); // Either<Error, 21>

// Get the value or a default
const value = errorResult.getOrElse(0); // 0
```

### Pattern Matching

```typescript
// Using conditional checks
if (result.isRight()) {
  console.log('Success:', result.unwrap());
} else {
  console.log('Error:', result.unwrapError());
}

// Using toResult()
const { success, value, error } = result.toResult();
if (success) {
  console.log('Success:', value);
} else {
  console.log('Error:', error);
}
```

## Async Either

`AsyncEither` extends the Either concept to work seamlessly with asynchronous operations.

### Creating AsyncEither values

```typescript
import { AsyncEither, asyncRight, asyncLeft } from 'ts-either';

// From Promise
const asyncResult = AsyncEither.fromPromise<number, Error>(Promise.resolve(42));

// From Either
const eitherResult = asyncRight<Error, number>(42);

// From a function that might throw
const fetchData = async (id: string) => {
  return AsyncEither.tryCatch<Error, User>(fetch(`/api/users/${id}`)).map(
    (res) => res.json(),
  );
};
```

### Working with AsyncEither

```typescript
const result = await fetchData('123')
  .map((user) => user.name)
  .mapError((err) => new CustomError('Failed to fetch user', err))
  .tapBoth(
    (name) => console.log(`User: ${name}`),
    (err) => console.error(`Error: ${err.message}`),
  );

// Await and get the value or a default
const username = await result.getOrElse('Unknown user');
```

## API Reference

### Either<L, R>

| Method                                                                                          | Description                              |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `map<T>(mapper: (value: R) => T): Either<L, T>`                                                 | Transform the right value                |
| `mapError<T>(fn: (err: L) => T): Either<T, R>`                                                  | Transform the left value                 |
| `flatMap<U, T>(mapper: (value: R) => Either<U, T>): Either<L \| U, T>`                          | Chain operations that might fail         |
| `filter<E>(predicate: (value: R) => boolean, errorFactory: (value: R) => E): Either<L \| E, R>` | Convert right to left if predicate fails |
| `getOrElse(defaultValue: R): R`                                                                 | Extract the value or return default      |
| `getErrorOrElse(defaultError: L): L`                                                            | Extract the error or return default      |
| `isRight(): boolean`                                                                            | Check if instance is Right               |
| `isLeft(): boolean`                                                                             | Check if instance is Left                |
| `unwrap(): R`                                                                                   | Extract value (throws if Left)           |
| `unwrapError(): L`                                                                              | Extract error (throws if Right)          |
| `tap(fn: (value: R) => void): Either<L, R>`                                                     | Side effect on success                   |
| `tapError(fn: (error: L) => void): Either<L, R>`                                                | Side effect on error                     |
| `tapBoth(rightFn, leftFn): Either<L, R>`                                                        | Side effect on either path               |
| `toResult(): { success: boolean, value?: R, error?: L }`                                        | Convert to result object                 |

### AsyncEither<L, R>

All Either methods plus:

| Method                                                             | Description                          |
| ------------------------------------------------------------------ | ------------------------------------ |
| `static fromPromise<R, L>(promise: Promise<R>): AsyncEither<L, R>` | Create from Promise                  |
| `static fromEither<L, R>(either: Either<L, R>): AsyncEither<L, R>` | Create from Either                   |
| `static tryCatch<L, R>(promise: Promise<R>): AsyncEither<L, R>`    | Create from Promise that might throw |
| `then/catch`                                                       | Promise compatibility                |

## Examples

### Data Fetching

```typescript
type User = { id: string; name: string };
type ApiError = { code: number; message: string };

const fetchUser = async (id: string): Promise<AsyncEither<ApiError, User>> => {
  return AsyncEither.tryCatch<ApiError, Response>(
    fetch(`/api/users/${id}`),
  ).flatMap(async (res) => {
    if (!res.ok) {
      const error = await res.json();
      return left(error);
    }
    const user = await res.json();
    return right(user);
  });
};

// Usage
const processUser = async (id: string) => {
  const result = await fetchUser(id)
    .map((user) => user.name)
    .mapError((err) => ({
      ...err,
      message: `Failed to fetch user: ${err.message}`,
    }));

  return result.toResult();
};
```

### Validation Chain

```typescript
type ValidationError = { field: string; message: string };

const validateEmail = (email: string): Either<ValidationError, string> => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? right(email)
    : left({ field: 'email', message: 'Invalid email format' });
};

const validatePassword = (
  password: string,
): Either<ValidationError, string> => {
  return password.length >= 8
    ? right(password)
    : left({
        field: 'password',
        message: 'Password must be at least 8 characters',
      });
};

const validateUser = (email: string, password: string) => {
  return validateEmail(email).flatMap((validEmail) =>
    validatePassword(password).map((validPassword) => ({
      email: validEmail,
      password: validPassword,
    })),
  );
};
```

## License

MIT
