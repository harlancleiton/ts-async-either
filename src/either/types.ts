import type { Either } from './either';

export type PromiseEither<L, R> = Promise<Either<L, R>>;
