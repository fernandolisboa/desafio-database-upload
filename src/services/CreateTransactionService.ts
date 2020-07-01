import { getRepository, getCustomRepository } from 'typeorm';

import AppError from '../errors/AppError';

import TransactionRepository from '../repositories/TransactionsRepository';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface CreateTransactionDTO
  extends Pick<Transaction, 'title' | 'value' | 'type'> {
  categoryTitle: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    categoryTitle,
  }: CreateTransactionDTO): Promise<Transaction> {
    if (!['income', 'outcome'].includes(type)) {
      throw new Error('Invalid transaction type.');
    }

    const transactionsRepository = getCustomRepository(TransactionRepository);

    const { total } = await transactionsRepository.getBalance();

    if (type === 'outcome' && total < value) {
      throw new AppError(
        'You do not have enough balance to perform this transaction.',
      );
    }

    const categoryRepository = getRepository(Category);

    let category = await categoryRepository.findOne({
      where: { title: categoryTitle },
    });

    if (!category) {
      category = categoryRepository.create({
        title: categoryTitle,
      });

      await categoryRepository.save(category);
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
