import { Test } from '@nestjs/testing';
import { DestroyOptions } from 'sequelize';
import { Model, ModelCtor } from 'sequelize-typescript';
import { Company } from '../../db/models/Company';
import { Ticket } from '../../db/models/Ticket';
import { User } from '../../db/models/User';
import { DbModule } from '../db.module';

export async function cleanTables() {
  await Test.createTestingModule({
    imports: [DbModule],
  }).compile();

  const models: ModelCtor<Model>[] = [Ticket, User, Company];
  for (const model of models) {
    await cleanTable(model);
  }

  async function cleanTable<T extends Model>(model: ModelCtor<T>) {
    const options: DestroyOptions = {
      where: {},
    };
    try {
      await model.unscoped().destroy(options);
    } catch (err) {
      // https://github.com/sequelize/sequelize/issues/14807
      console.error(err as Error);
      throw err;
    }
  }
}
