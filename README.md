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

- **Left** — typically representing an error or failure
- **Right** — typically representing a successful result

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
const doubled = successResult.map((value) => value * 2); // Right(84)

// FlatMap (chain) for operations that might fail
const safelyDivide = (n: number, divisor: number): Either<string, number> => {
  if (divisor === 0) return left('Division by zero');
  return right(n / divisor);
};

const result = successResult.flatMap((value) => safelyDivide(value, 2)); // Right(21)

// Get the value or a default
const value = errorResult.getOrElse(0); // 0
```

### Pattern Matching

```typescript
// Using type guards
if (result.isRight()) {
  console.log('Success:', result.unwrap());
} else {
  console.log('Error:', result.unwrapError());
}

// Using toResult()
const outcome = result.toResult();
if (outcome.success) {
  console.log('Value:', outcome.value);
} else {
  console.log('Error:', outcome.error);
}
```

---

## AsyncEither

`AsyncEither` extends the Either concept to work seamlessly with asynchronous operations. It implements the `Promise` interface, so you can `await` it directly.

### Creating AsyncEither values

```typescript
import { AsyncEither, asyncRight, asyncLeft } from 'ts-either';

// From a Promise that might reject
const result = AsyncEither.tryCatch<Error, Response>(fetch('/api/users/1'));

// From a resolved value
const success = asyncRight<Error, number>(42);

// From an error
const failure = asyncLeft<string, number>('Something went wrong');

// From an existing Either
const fromEither = AsyncEither.fromEither(right(42));

// From a raw Promise
const fromPromise = AsyncEither.fromPromise<number>(Promise.resolve(42));
```

---

## Examples

### User Registration

A complete user registration flow with validation, persistence, and notification — all composed with `AsyncEither`.

```typescript
import { AsyncEither, asyncRight, asyncLeft, left, right } from 'ts-either';

// --- Domain types ---

interface CreateUserDTO {
  email: string;
  password: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

class EmailAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Email ${email} is already registered`);
  }
}

class WeakPasswordError extends Error {
  constructor() {
    super('Password must be at least 8 characters');
  }
}

class InvalidEmailError extends Error {
  constructor() {
    super('Invalid email format');
  }
}

// --- Repository (simulated) ---

const userRepository = {
  findByEmail: (email: string): Promise<User | null> => {
    /* ... */
  },
  save: (data: CreateUserDTO): Promise<User> => {
    /* ... */
  },
};

// --- Use case ---

type RegistrationError =
  | InvalidEmailError
  | WeakPasswordError
  | EmailAlreadyExistsError;

function registerUser(
  dto: CreateUserDTO,
): AsyncEither<RegistrationError, User> {
  return asyncRight<RegistrationError, CreateUserDTO>(dto)
    .filter(
      (dto) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email),
      () => new InvalidEmailError(),
    )
    .filter(
      (dto) => dto.password.length >= 8,
      () => new WeakPasswordError(),
    )
    .flatMap((dto) =>
      AsyncEither.tryCatch<RegistrationError, User | null>(
        userRepository.findByEmail(dto.email),
      ).flatMap((existingUser) =>
        existingUser
          ? asyncLeft(new EmailAlreadyExistsError(dto.email))
          : AsyncEither.tryCatch(userRepository.save(dto)),
      ),
    )
    .tap((user) => {
      console.log(`User created: ${user.email}`);
      sendWelcomeEmail(user.email);
    })
    .tapError((err) => {
      console.error(`Registration failed: ${err.message}`);
    });
}

// --- Controller ---

async function handleRegistration(dto: CreateUserDTO) {
  const result = await registerUser(dto).toResult();
  // Success → { success: true, value: { id: 'u-123', email: 'john@mail.com', name: 'John' } }
  // Failure → { success: false, error: InvalidEmailError('Invalid email format') }

  if (result.success) {
    return { status: 201, body: result.value };
    // { status: 201, body: { id: 'u-123', email: 'john@mail.com', name: 'John' } }
  }

  if (result.error instanceof EmailAlreadyExistsError) {
    return { status: 409, body: { message: result.error.message } };
    // { status: 409, body: { message: 'Email john@mail.com is already registered' } }
  }

  return { status: 422, body: { message: result.error.message } };
  // { status: 422, body: { message: 'Password must be at least 8 characters' } }
}
```

**What this demonstrates:**

- **`filter`** — validates the DTO fields inline, short-circuiting to Left on failure
- **`flatMap`** — chains async operations that can fail (check duplicates → persist)
- **`tap` / `tapError`** — side effects (logging, emails) without altering the pipeline
- **`toResult`** — converts to a plain object for easy pattern matching in the controller

---

### Bank Account Withdrawal

A bank withdrawal flow with balance checks, daily limit validation, and error recovery.

```typescript
import { AsyncEither, asyncRight, asyncLeft, left, right } from 'ts-either';

// --- Domain types ---

interface Account {
  id: string;
  balance: number;
  dailyWithdrawn: number;
}

interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  timestamp: Date;
}

class InsufficientFundsError extends Error {
  constructor(balance: number, amount: number) {
    super(`Insufficient funds: balance is ${balance}, requested ${amount}`);
  }
}

class DailyLimitExceededError extends Error {
  constructor() {
    super('Daily withdrawal limit of 5000 exceeded');
  }
}

class AccountNotFoundError extends Error {
  constructor(id: string) {
    super(`Account ${id} not found`);
  }
}

// --- Repository (simulated) ---

const accountRepository = {
  findById: (id: string): Promise<Account | null> => {
    /* ... */
  },
  debit: (id: string, amount: number): Promise<Transaction> => {
    /* ... */
  },
};

const DAILY_LIMIT = 5000;

// --- Use case ---

type WithdrawalError =
  | AccountNotFoundError
  | InsufficientFundsError
  | DailyLimitExceededError;

function withdraw(
  accountId: string,
  amount: number,
): AsyncEither<WithdrawalError, Transaction> {
  return AsyncEither.tryCatch<WithdrawalError, Account | null>(
    accountRepository.findById(accountId),
  )
    .flatMap((account) =>
      account
        ? asyncRight<WithdrawalError, Account>(account)
        : asyncLeft(new AccountNotFoundError(accountId)),
    )
    .filter(
      (account) => account.balance >= amount,
      (account) => new InsufficientFundsError(account.balance, amount),
    )
    .filter(
      (account) => account.dailyWithdrawn + amount <= DAILY_LIMIT,
      () => new DailyLimitExceededError(),
    )
    .flatMap((account) =>
      AsyncEither.tryCatch(accountRepository.debit(account.id, amount)),
    )
    .tap((tx) => {
      console.log(`Transaction ${tx.id} completed: -${tx.amount}`);
    });
}

// --- Controller ---

async function handleWithdrawal(accountId: string, amount: number) {
  const transaction = await withdraw(accountId, amount).toResult();
  // Success → { success: true, value: { id: 'tx-456', accountId: 'acc-1', amount: 200, timestamp: 2026-02-11T... } }
  // Failure → { success: false, error: InsufficientFundsError('Insufficient funds: balance is 100, requested 200') }

  if (transaction.success) {
    return { status: 200, body: transaction.value };
    // { status: 200, body: { id: 'tx-456', accountId: 'acc-1', amount: 200, timestamp: '2026-02-11T...' } }
  }

  if (transaction.error instanceof InsufficientFundsError) {
    return { status: 422, body: { message: transaction.error.message } };
    // { status: 422, body: { message: 'Insufficient funds: balance is 100, requested 200' } }
  }

  if (transaction.error instanceof AccountNotFoundError) {
    return { status: 404, body: { message: transaction.error.message } };
    // { status: 404, body: { message: 'Account acc-999 not found' } }
  }

  return { status: 400, body: { message: transaction.error.message } };
  // { status: 400, body: { message: 'Daily withdrawal limit of 5000 exceeded' } }
}
```

**What this demonstrates:**

- **`tryCatch`** — wraps a Promise that might reject into an AsyncEither
- **`flatMap`** — transforms a nullable result into a typed Left/Right
- **`filter`** — business rule guards (balance and daily limit) with domain-specific errors
- Sequential chaining — each step only runs if the previous succeeded

---

### Combining Multiple Async Operations

Use `AsyncEither.all` to run operations in parallel and fail fast on the first error, or `AsyncEither.fromMany` to wait for all results and collect errors.

```typescript
// --- Fail fast with AsyncEither.all ---

async function createUserWithProfile(dto: CreateUserDTO) {
  const result = await AsyncEither.all([
    createUser(dto),
    createDefaultProfile(dto),
    reserveUsername(dto.name),
  ]);

  // If ANY operation fails, result is Left with the first error.
  // If ALL succeed, result is Right with a tuple [User, Profile, Username].
  return result.toResult();
  // Success → { success: true, value: [User, Profile, Username] }
  // Failure → { success: false, error: Error('Username already taken') }
}

// --- Collect all errors with AsyncEither.fromMany ---

async function validateAll(dto: CreateUserDTO) {
  const result = await AsyncEither.fromMany([
    validateEmail(dto.email),
    validatePassword(dto.password),
    checkUsernameAvailability(dto.name),
  ]);

  // Waits for ALL operations to settle.
  // If multiple fail, returns an AsyncEitherSettledError containing all errors.
  return result.toResult();
  // All pass  → { success: true, value: ['john@mail.com', 'S3cur3P@ss', 'johndoe'] }
  // One fails → { success: false, error: WeakPasswordError('Password must be at least 8 characters') }
  // Many fail → { success: false, error: AsyncEitherSettledError({ errors: [InvalidEmailError, WeakPasswordError] }) }
}
```

---

### Error Recovery

Use `recover` to provide a fallback when an operation fails.

```typescript
function fetchUserWithFallback(userId: string): AsyncEither<Error, User> {
  return AsyncEither.tryCatch<Error, User>(fetchUserFromCache(userId)).recover(
    (cacheError) =>
      AsyncEither.tryCatch<Error, User>(fetchUserFromDatabase(userId)).tapError(
        (dbError) => {
          console.error('Cache miss:', cacheError.message);
          console.error('DB error:', dbError.message);
        },
      ),
  );
}

// Falls back to database if cache fails.
// If both fail, the final Left contains the database error.
const user = await fetchUserWithFallback('user-123').getOrElse({
  id: 'unknown',
  email: '',
  name: 'Guest',
});
// Cache hit   → { id: 'user-123', email: 'john@mail.com', name: 'John' }
// Cache miss  → { id: 'user-123', email: 'john@mail.com', name: 'John' }  (from DB)
// Both fail   → { id: 'unknown', email: '', name: 'Guest' }               (default)
```

---

### Using mapError for Error Normalization

Normalize domain errors into a standard HTTP response shape.

```typescript
interface HttpError {
  statusCode: number;
  message: string;
}

function withdrawAndNormalize(
  accountId: string,
  amount: number,
): AsyncEither<HttpError, Transaction> {
  return withdraw(accountId, amount).mapError((err): HttpError => {
    if (err instanceof AccountNotFoundError) {
      return { statusCode: 404, message: err.message };
    }
    if (err instanceof InsufficientFundsError) {
      return { statusCode: 422, message: err.message };
    }
    return { statusCode: 400, message: err.message };
  });
}

const result = await withdrawAndNormalize('acc-1', 100).toResult();
// Success → { success: true, value: { id: 'tx-789', accountId: 'acc-1', amount: 100, ... } }
// Failure → { success: false, error: { statusCode: 422, message: 'Insufficient funds: ...' } }

if (!result.success) {
  // result.error is HttpError — ready to send as response
  return res.status(result.error.statusCode).json(result.error);
  // res.status(404).json({ statusCode: 404, message: 'Account acc-1 not found' })
}
```

---

## API Reference

### Either<L, R>

| Method                                                                                          | Description                              |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `map<T>(fn: (value: R) => T): Either<L, T>`                                                     | Transform the right value                |
| `mapError<T>(fn: (err: L) => T): Either<T, R>`                                                  | Transform the left value                 |
| `flatMap<U, T>(fn: (value: R) => Either<U, T>): Either<L \| U, T>`                              | Chain operations that might fail         |
| `filter<E>(predicate: (value: R) => boolean, errorFactory: (value: R) => E): Either<L \| E, R>` | Convert right to left if predicate fails |
| `getOrElse(defaultValue: R): R`                                                                 | Extract the value or return default      |
| `getErrorOrElse(defaultError: L): L`                                                            | Extract the error or return default      |
| `isRight(): boolean`                                                                            | Check if instance is Right               |
| `isLeft(): boolean`                                                                             | Check if instance is Left                |
| `unwrap(): R`                                                                                   | Extract value (throws if Left)           |
| `unwrapError(): L`                                                                              | Extract error (throws if Right)          |
| `unwrapOrThrow(): R`                                                                            | Extract value or throw (alias)           |
| `tap(fn: (value: R) => void): Either<L, R>`                                                     | Side effect on success                   |
| `tapError(fn: (error: L) => void): Either<L, R>`                                                | Side effect on error                     |
| `tapBoth(rightFn, leftFn): Either<L, R>`                                                        | Side effect on either path               |
| `toResult(): { success: boolean, value?: R, error?: L }`                                        | Convert to result object                 |

### AsyncEither<L, R>

Inherits all Either methods (async-compatible) plus:

| Method                                                                       | Description                                  |
| ---------------------------------------------------------------------------- | -------------------------------------------- |
| `static tryCatch<L, R>(promise: Promise<R>): AsyncEither<L, R>`              | Create from Promise that might reject        |
| `static fromPromise<R, L>(promise: Promise<R>): AsyncEither<L, R>`           | Create from Promise                          |
| `static fromEither<L, R>(either: Either<L, R>): AsyncEither<L, R>`           | Create from Either                           |
| `static all<T>(promises: AsyncEither[]): AsyncEither<L, R[]>`                | Parallel execution, fail fast on first error |
| `static fromMany<T>(asyncEithers: AsyncEither[]): AsyncEither<L, R[]>`       | Parallel execution, collect all errors       |
| `static allSettled<T>(promises: (AsyncEither \| Promise)[]): AsyncEither[]`  | Convert array to independent AsyncEithers    |
| `recover<U>(fn: (err: L) => AsyncEither<L \| U, R>): AsyncEither<L \| U, R>` | Recover from a Left with a fallback          |
| `orThrow(): Promise<R>`                                                      | Unwrap or throw (async)                      |
| `then / catch`                                                               | Promise interface compatibility              |

## License

MIT
