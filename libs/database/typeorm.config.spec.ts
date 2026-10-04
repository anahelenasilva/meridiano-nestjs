import { typeParsers } from './type-parsers';
import { typeormConfig } from './typeorm.config';

describe('typeormConfig', () => {
  it('passes the type parsers to the TypeORM pg pool', () => {
    expect(typeormConfig).toMatchObject({ extra: { types: typeParsers } });
  });
});
